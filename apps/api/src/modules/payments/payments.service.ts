import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import Stripe from "stripe";
import { env } from "../../config/env";

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(env().STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
    });
  }

  async createPaymentIntent(buyerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        status: true,
        totalCents: true,
        currency: true,
        reservationExpiresAt: true,
        paymentIntentId: true,
      },
    });

    if (!order) throw new NotFoundException("Order not found");
    if (order.buyerId !== buyerId) throw new ForbiddenException("Only buyer can pay");
    if (order.status !== "pending_payment") {
      throw new BadRequestException({ error: { code: "INVALID_STATE", message: "Order is not payable" } });
    }

    if (order.reservationExpiresAt && order.reservationExpiresAt < new Date()) {
      throw new BadRequestException({ error: { code: "EXPIRED", message: "Reservation expired" } });
    }

    // Reuse existing PI if present
    if (order.paymentIntentId) {
      const pi = await this.stripe.paymentIntents.retrieve(order.paymentIntentId);
      if (!pi.client_secret) throw new BadRequestException("PaymentIntent missing client_secret");
      return { orderId: order.id, paymentIntentId: pi.id, clientSecret: pi.client_secret };
    }

    const pi = await this.stripe.paymentIntents.create({
      amount: order.amountCents,
      currency: order.currency || "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId: order.id,
        sellerId: order.sellerId,
        buyerId: order.buyerId,
      },
    });

    if (!pi.client_secret) throw new BadRequestException("PaymentIntent missing client_secret");

    await this.prisma.order.update({
      where: { id: order.id },
      data: { paymentIntentId: pi.id },
    });

    return { orderId: order.id, paymentIntentId: pi.id, clientSecret: pi.client_secret };
  }
}
