import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import Stripe from "stripe";
import { PrismaService } from "../../prisma/prisma.service";
import { env } from "../../config/env";

type RefundCreateArgs = {
  actorUserId: string;            // buyer or seller or "admin"
  orderId: string;
  reason?: Stripe.RefundCreateParams.Reason;
  amountCents?: number;           // optional partial refund
  allowIfShipped?: boolean;       // admin override
};

@Injectable()
export class RefundsService {
  private stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(env().STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
  }

  async getRefundsForOrder(requestorId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, buyerId: true, sellerId: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.buyerId !== requestorId && order.sellerId !== requestorId) {
      throw new ForbiddenException("Not your order");
    }

    const refunds = await this.prisma.refund.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return { orderId, refunds };
  }

  /**
   * Core refund creator:
   * - idempotent-ish: if a non-failed refund already exists for the order, return it
   * - creates Stripe refund via PaymentIntent
   * - updates Order status to "refunded" (MVP)
   * - holds or reverses payout if needed
   */
  async createRefundForOrder(args: RefundCreateArgs) {
    const order = await this.prisma.order.findUnique({
      where: { id: args.orderId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        status: true,
        amountCents: true,
        currency: true,
        paymentIntentId: true,
      },
    });
    if (!order) throw new NotFoundException("Order not found");

    const isAdmin = args.actorUserId === "admin";
    const isParty = order.buyerId === args.actorUserId || order.sellerId === args.actorUserId;
    if (!isAdmin && !isParty) throw new ForbiddenException("Not allowed");

    // Guardrails: typically refunds are allowed pre-shipment
    if (!args.allowIfShipped) {
      if (order.status === "shipped" || order.status === "completed") {
        throw new BadRequestException({
          error: { code: "INVALID_STATE", message: "Refunds after shipment should use disputes/returns flow" },
        });
      }
    }

    if (!order.paymentIntentId) {
      throw new BadRequestException({
        error: { code: "MISSING_PAYMENT", message: "Order has no payment to refund" },
      });
    }

    // If refund already exists, return existing (idempotency)
    const existing = await this.prisma.refund.findFirst({
      where: { orderId: order.id, status: { not: "failed" } },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return { ok: true, deduped: true, refund: existing };
    }

    const amount = args.amountCents ?? order.amountCents;

    // Create Stripe refund (PaymentIntent or Charge is allowed; PI is simplest)
    const refund = await this.stripe.refunds.create({
      payment_intent: order.paymentIntentId,
      amount,
      reason: args.reason,
      metadata: {
        orderId: order.id,
        actorUserId: args.actorUserId,
      },
    });

    // Persist + update order + payout actions
    const saved = await this.prisma.$transaction(async (tx) => {
      const r = await tx.refund.create({
        data: {
          orderId: order.id,
          stripeRefundId: refund.id,
          amountCents: refund.amount ?? amount,
          currency: refund.currency ?? order.currency ?? "usd",
          status: refund.status ?? "unknown",
          reason: args.reason ?? null,
          createdByUserId: isAdmin ? null : args.actorUserId,
        },
      });

      // Mark order refunded (MVP). If you want “refund_pending”, add enum later.
      await tx.order.update({
        where: { id: order.id },
        data: { status: "refunded" },
      });

      // Payout hold/reversal logic
      const payout = await tx.payout.findUnique({
        where: { orderId: order.id },
        select: {
          id: true,
          status: true,
          amountCents: true,
          currency: true,
          stripeTransferId: true,
        },
      }).catch(() => null);

      if (payout) {
        // If payout not released yet, just hold it
        if (payout.status === "eligible") {
          await tx.payout.update({
            where: { id: payout.id },
            data: { status: "held", holdReason: "refund_initiated" },
          });
        }

        // If payout already released, attempt transfer reversal
        if (payout.status === "released" && payout.stripeTransferId) {
          await tx.payout.update({
            where: { id: payout.id },
            data: { status: "reversing", holdReason: "refund_initiated" },
          });

          // Do reversal outside the tx (Stripe call), but we’ll keep it simple here:
        }
      }

      return { refundRow: r, payout };
    });

    // If transfer reversal needed, do it now (outside transaction)
    if (saved.payout && saved.payout.status === "released" && saved.payout.stripeTransferId) {
      try {
        const rev = await this.stripe.transfers.createReversal(saved.payout.stripeTransferId, {
          amount: Math.min(saved.payout.amountCents, saved.refundRow.amountCents),
          metadata: { orderId: order.id, refundId: saved.refundRow.id },
        });

        await this.prisma.payout.update({
          where: { orderId: order.id },
          data: {
            status: "reversed",
            stripeTransferReversalId: rev.id,
          },
        });
      } catch (e: any) {
        await this.prisma.payout.update({
          where: { orderId: order.id },
          data: {
            status: "reversal_failed",
            holdReason: `refund_reversal_failed`,
          },
        });
      }
    }

    return { ok: true, refund: saved.refundRow };
  }

  /**
   * Webhook sync: upsert refund by stripeRefundId, link to order via metadata.orderId if present.
   */
  async upsertRefundFromStripe(refund: Stripe.Refund) {
    const orderId = (refund.metadata?.orderId as string | undefined) ?? null;
    if (!orderId) {
      // If you want to resolve by payment_intent -> order.paymentIntentId, add that lookup later.
      return { ok: true, skipped: true };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.refund.upsert({
        where: { stripeRefundId: refund.id },
        create: {
          orderId,
          stripeRefundId: refund.id,
          amountCents: refund.amount ?? 0,
          currency: refund.currency ?? "usd",
          status: refund.status ?? "unknown",
          reason: (refund.reason as any) ?? null,
          createdByUserId: null,
        },
        update: {
          status: refund.status ?? "unknown",
        },
      });

      // If refund succeeded (or exists), mark order refunded (MVP)
      await tx.order.update({
        where: { id: orderId },
        data: { status: "refunded" },
      }).catch(() => {});
    });

    return { ok: true };
  }
}
