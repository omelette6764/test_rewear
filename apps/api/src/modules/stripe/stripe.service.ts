import { BadRequestException, Injectable } from "@nestjs/common";
import Stripe from "stripe";
import { PrismaService } from "../../prisma/prisma.service";
import { env } from "../../config/env";

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(env().STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const e = env();
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, e.STRIPE_WEBHOOK_SECRET);
    } catch {
      throw new BadRequestException("Invalid webhook signature");
    }

    // Dedupe if you have StripeEvent table
    const already = await this.prisma.stripeEvent.findUnique({ where: { stripeEventId: event.id } }).catch(() => null);
    if (already?.processedAt) {
      return { received: true, deduped: true };
    }
    if (!already) {
      await this.prisma.stripeEvent.create({
        data: { id: event.id, type: event.type, payloadJson: JSON.stringify(event) },
      }).catch(() => {});
    }

    // Process
    switch (event.type) {
      case "payment_intent.succeeded":
        await this.onPaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.payment_failed":
        await this.onPaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        break;
    }

    await this.prisma.stripeEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    }).catch(() => {});

    return { received: true };
  }

  private async onPaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
    const orderId = pi.metadata?.orderId;
    if (!orderId) return;

    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, listingId: true },
      });
      if (!order) return;

      // idempotent: only move forward from pending_payment
      if (order.status !== "pending_payment") return;

      await tx.order.update({
        where: { id: orderId },
        data: { status: "processing" },
      });

      // Mark listing sold (or keep it “sold/processing” depending on your model)
      await tx.listing.update({
        where: { id: order.listingId },
        data: { status: "sold", reservedUntil: null },
      });
    });
  }

  private async onPaymentIntentFailed(pi: Stripe.PaymentIntent) {
    const orderId = pi.metadata?.orderId;
    if (!orderId) return;

    // Don’t auto-cancel on failure (users often retry).
    // We just keep order as pending_payment unless reservation expires elsewhere.
  }
}
