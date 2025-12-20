import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import Stripe from "stripe";
import { env } from "../../config/env";

@Injectable()
export class PayoutsService {
  private readonly log = new Logger(PayoutsService.name);
  private stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(env().STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
  }

  /**
   * Called when seller adds tracking (or when order moves to shipped):
   * ensures a payout record exists + sets eligibleAt.
   */
  async markEligibleFromTracking(orderId: string, shippedAt: Date) {
    const e = env();
    const eligibleAt = new Date(shippedAt.getTime() + e.PAYOUT_DELAY_HOURS * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          sellerId: true,
          amountCents: true,
          currency: true,
        },
      });
      if (!order) return;

      // Only allow eligibility when shipped/completed/processing (depending on your state machine)
      if (!["shipped", "completed", "processing", "paid"].includes(order.status)) return;

      // Upsert payout row
      await tx.payout.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          sellerId: order.sellerId,
          amountCents: this.netPayoutAmount(order.amountCents),
          currency: order.currency || "usd",
          status: "eligible",
          eligibleAt,
        },
        update: {
          status: "eligible",
          eligibleAt,
          amountCents: this.netPayoutAmount(order.amountCents),
        },
      });
    });
  }

  /**
   * Releases payouts that are eligible and past their eligibleAt time.
   * Guardrails:
   * - requires seller Stripe account
   * - skips if order is canceled/refunded/disputed
   * - idempotent: if payout already released, no-op
   */
  async releaseEligibleBatch(opts: { limit: number }) {
    const now = new Date();

    const payouts = await this.prisma.payout.findMany({
      where: {
        status: "eligible",
        eligibleAt: { lte: now },
      },
      orderBy: { eligibleAt: "asc" },
      take: opts.limit,
      select: {
        id: true,
        orderId: true,
        sellerId: true,
        amountCents: true,
        currency: true,
      },
    });

    let released = 0;
    let skipped = 0;
    const errors: Array<{ payoutId: string; reason: string }> = [];

    for (const p of payouts) {
      try {
        const ok = await this.releaseOne(p.id);
        if (ok) released++;
        else skipped++;
      } catch (err: any) {
        errors.push({ payoutId: p.id, reason: err?.message ?? String(err) });
      }
    }

    return { released, skipped, errors };
  }

  async releaseOne(payoutId: string): Promise<boolean> {
    const e = env();

    return await this.prisma.$transaction(async (tx) => {
      const payout = await tx.payout.findUnique({
        where: { id: payoutId },
        select: {
          id: true,
          status: true,
          orderId: true,
          sellerId: true,
          amountCents: true,
          currency: true,
          stripeTransferId: true,
        },
      });
      if (!payout) return false;

      // Idempotent
      if (payout.status === "released") return false;
      if (payout.stripeTransferId) {
        // If a transfer exists but status not updated, normalize:
        await tx.payout.update({
          where: { id: payout.id },
          data: { status: "released", releasedAt: new Date() },
        });
        return true;
      }

      const order = await tx.order.findUnique({
        where: { id: payout.orderId },
        select: {
          id: true,
          status: true,
          sellerId: true,
          amountCents: true,
          currency: true,
        },
      });
      if (!order) {
        await tx.payout.update({ where: { id: payout.id }, data: { status: "held", holdReason: "order_missing" } });
        return false;
      }

      // Hard guardrails: never pay out if canceled/refunded/disputed
      if (["canceled", "refunded", "disputed"].includes(order.status as any)) {
        await tx.payout.update({
          where: { id: payout.id },
          data: { status: "held", holdReason: `order_${order.status}` },
        });
        return false;
      }

      // Seller must have a Stripe connected account
      const seller = await tx.stripeSeller.findUnique({
        where: { userId: payout.sellerId },
        select: {
          userId: true,
          stripeAccountId: true,
          chargesEnabled: true,
          payoutsEnabled: true,
          detailsSubmitted: true,
        },
      });

      if (!seller?.stripeAccountId) {
        await tx.payout.update({
          where: { id: payout.id },
          data: { status: "held", holdReason: "seller_not_onboarded" },
        });
        return false;
      }

      // Require “ready to receive funds”
      if (!seller.payoutsEnabled || !seller.detailsSubmitted) {
        await tx.payout.update({
          where: { id: payout.id },
          data: { status: "held", holdReason: "seller_not_ready" },
        });
        return false;
      }

      // Create Transfer
      const transfer = await this.stripe.transfers.create({
        amount: payout.amountCents,
        currency: payout.currency || "usd",
        destination: seller.stripeAccountId,
        metadata: {
          payoutId: payout.id,
          orderId: payout.orderId,
          sellerId: payout.sellerId,
        },
      });

      await tx.payout.update({
        where: { id: payout.id },
        data: {
          status: "released",
          releasedAt: new Date(),
          stripeTransferId: transfer.id,
        },
      });

      this.log.log(`Released payout ${payout.id} via transfer ${transfer.id}`);
      return true;
    });
  }

  private netPayoutAmount(grossCents: number) {
    const e = env();
    const fee = Math.floor((grossCents * e.PLATFORM_FEE_BPS) / 10_000);
    const net = grossCents - fee;
    return Math.max(net, 0);
  }
}