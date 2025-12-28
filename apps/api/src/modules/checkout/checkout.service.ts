import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CheckoutService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertActiveUser(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { isBanned: true } });
    if (!u) throw new NotFoundException("User not found");
    if (u.isBanned) throw new ForbiddenException("Account disabled");
  }

  /**
   * Start checkout:
   * - validates listing is active
   * - reserves it for 15 minutes
   * - creates Order in pending_payment
   */
  async start(buyerId: string, listingId: string) {
    await this.assertActiveUser(buyerId);

    const reservationMinutes = 15;
    const expiresAt = new Date(Date.now() + reservationMinutes * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { id: listingId },
        select: {
          id: true,
          status: true,
          hiddenAt: true,
          sellerId: true,
          reservedUntil: true,
          reservedByOrderId: true,
          priceCents: true,
          seller: { select: { isBanned: true } },
        },
      });

      if (!listing || listing.hiddenAt || listing.seller.isBanned) {
        throw new NotFoundException("Listing not available");
      }
      if (listing.sellerId === buyerId) {
        throw new BadRequestException({ error: { code: "INVALID", message: "Cannot buy your own listing" } });
      }

      // If reserved and still valid, block
      if (listing.reservedUntil && listing.reservedUntil > new Date()) {
        throw new BadRequestException({ error: { code: "RESERVED", message: "Listing is reserved right now" } });
      }

      if (listing.status !== "active") {
        throw new BadRequestException({ error: { code: "NOT_ACTIVE", message: "Listing not active" } });
      }

      const order = await tx.order.create({
        data: {
          buyerId,
          sellerId: listing.sellerId,
          listingId: listing.id,
          status: "pending_payment",
          totalCents: listing.priceCents,
          currency: "usd",
          reservationExpiresAt: expiresAt,
        },
        select: { id: true, status: true, reservationExpiresAt: true },
      });

      await tx.listing.update({
        where: { id: listing.id },
        data: {
          status: "reserved",
          reservedUntil: expiresAt,
          reservedByOrderId: order.id,
        },
      });

      return order;
    });

    return {
      orderId: result.id,
      status: result.status,
      reservationExpiresAt: result.reservationExpiresAt.toISOString(),
    };
  }

  async status(userId: string, orderId: string) {
    await this.assertActiveUser(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        status: true,
        reservationExpiresAt: true,
        paymentIntentClientSecret: true, // if you store it; otherwise remove
      },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.buyerId !== userId && order.sellerId !== userId) throw new ForbiddenException("Not your order");

    return {
      orderId: order.id,
      status: order.status,
      reservationExpiresAt: order.reservationExpiresAt?.toISOString?.() ?? null,
      paymentIntentClientSecret: (order as any).paymentIntentClientSecret ?? null,
    };
  }

  async cancel(buyerId: string, orderId: string) {
    await this.assertActiveUser(buyerId);

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, buyerId: true, status: true, listingId: true },
      });
      if (!order) throw new NotFoundException("Order not found");
      if (order.buyerId !== buyerId) throw new ForbiddenException("Only buyer can cancel");

      if (order.status !== "pending_payment") {
        throw new BadRequestException({ error: { code: "INVALID_STATE", message: "Cannot cancel after payment" } });
      }

      // release listing
      await tx.listing.update({
        where: { id: order.listingId },
        data: { status: "active", reservedUntil: null, reservedByOrderId: null },
      });

      const o2 = await tx.order.update({
        where: { id: orderId },
        data: { status: "canceled", canceledAt: now, cancelReason: "buyer_canceled" },
        select: { id: true, status: true },
      });

      return o2;
    });

    return { orderId: updated.id, status: updated.status };
  }
}
