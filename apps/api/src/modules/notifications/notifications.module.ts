import { Injectable } from "@nestjs/common";
import Stripe from "stripe";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertDisputeFromStripe(dispute: Stripe.Dispute) {
    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    if (!chargeId) return { ok: true, skipped: true };

    // Find the order by stripeChargeId (set on payment_intent.succeeded)
    const order = await this.prisma.order.findFirst({
      where: { stripeChargeId: chargeId },
      select: { id: true, status: true },
    });
    if (!order) return { ok: true, skipped: true };

    await this.prisma.$transaction(async (tx) => {
      await tx.dispute.upsert({
        where: { stripeDisputeId: dispute.id },
        create: {
          orderId: order.id,
          stripeDisputeId: dispute.id,
          stripeChargeId: chargeId,
          status: dispute.status,
          amountCents: dispute.amount ?? 0,
          currency: dispute.currency ?? "usd",
          reason: dispute.reason ?? null,
        },
        update: {
          status: dispute.status,
          amountCents: dispute.amount ?? 0,
          reason: dispute.reason ?? null,
        },
      });

      // Mark order disputed unless it’s already refunded/canceled
      const current = await tx.order.findUnique({
        where: { id: order.id },
        select: { status: true },
      });

      if (current && !["refunded", "canceled"].includes(current.status as any)) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "disputed" },
        });
      }

      // Hold payouts immediately
      const payout = await tx.payout.findUnique({
        where: { orderId: order.id },
        select: { id: true, status: true, stripeTransferId: true },
      }).catch(() => null);

      if (payout) {
        if (payout.status === "eligible") {
          await tx.payout.update({
            where: { id: payout.id },
            data: { status: "held", holdReason: "dispute_open" },
          });
        }

        if (payout.status === "released") {
          // If already released, you *may* attempt reversal (not always possible).
          await tx.payout.update({
            where: { id: payout.id },
            data: { status: "held", holdReason: "dispute_open_released" },
          });
          // If you want automatic reversal attempts here, mirror RefundsService logic.
        }
      }
    });

    return { ok: true };
  }

  async onDisputeClosed(dispute: Stripe.Dispute) {
    // Same upsert + decide whether to keep payout held
    await this.upsertDisputeFromStripe(dispute);

    // If dispute is closed and won, you might unhold payout.
    // MVP: we keep payout held until a human/admin reviews outcome.
    return { ok: true };
  }
}
