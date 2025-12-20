import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { env } from "../../config/env";
import Stripe from "stripe";

@Injectable()
export class ReservationsScheduler {
  private readonly log = new Logger(ReservationsScheduler.name);
  private stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(env().STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
  }

  /**
   * Every minute:
   * - find pending_payment orders whose reservation expired
   * - cancel them (idempotent)
   * - release listing back to active
   * - optionally cancel PaymentIntent to release any authorization
   */
  @Cron("*/1 * * * *")
  async expireReservations() {
    const e = env();
    if (!e.CRON_ENABLED) return;

    const now = new Date();

    // Find expired orders
    const expired = await this.prisma.order.findMany({
      where: {
        status: "pending_payment",
        reservationExpiresAt: { lt: now },
      },
      select: {
        id: true,
        listingId: true,
        paymentIntentId: true,
      },
      take: 200,
    });

    if (!expired.length) return;

    this.log.log(`Expiring ${expired.length} reservations`);

    for (const o of expired) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Re-read for idempotency inside tx
          const order = await tx.order.findUnique({
            where: { id: o.id },
            select: { id: true, status: true, listingId: true, paymentIntentId: true },
          });
          if (!order) return;
          if (order.status !== "pending_payment") return; // already handled

          // Cancel order
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: "canceled",
              canceledAt: now,
              cancelReason: "reservation_expired",
            },
          });

          // Release listing (only if it’s still reserved by this order)
          await tx.listing.updateMany({
            where: { id: order.listingId, reservedByOrderId: order.id },
            data: {
              status: "active",
              reservedUntil: null,
              reservedByOrderId: null,
            },
          });
        });

        // Optional: cancel PaymentIntent on Stripe
        if (o.paymentIntentId) {
          try {
            await this.stripe.paymentIntents.cancel(o.paymentIntentId);
          } catch {
            // ignore – Stripe may already be succeeded/canceled; webhook/other flows handle it
          }
        }
      } catch (err: any) {
        this.log.warn(`Failed to expire order ${o.id}: ${err?.message ?? err}`);
      }
    }
  }
}