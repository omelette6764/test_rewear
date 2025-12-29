import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertActiveUser(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { isBanned: true } });
    if (!u) throw new NotFoundException("User not found");
    if (u.isBanned) throw new ForbiddenException("Account disabled");
  }

  async listBuyerOrders(buyerId: string, status?: string) {
    await this.assertActiveUser(buyerId);

    const where: any = { buyerId };
    if (status) where.status = status;

    const rows = await this.prisma.order.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        listing: { select: { id: true, title: true, coverPhotoUrl: true, priceCents: true, size: true, category: true } },
        seller: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    return {
      items: rows.map((o) => ({
        id: o.id,
        status: o.status,
        totalCents: o.totalCents,
        currency: o.currency,
        listing: {
          id: o.listing.id,
          title: o.listing.title,
          coverPhotoUrl: o.listing.coverPhotoUrl ?? null,
          priceCents: o.listing.priceCents,
          size: o.listing.size ?? null,
          category: o.listing.category,
        },
        otherUser: {
          id: o.seller.id,
          displayName: o.seller.displayName,
          avatarUrl: o.seller.avatarUrl ?? null,
        },
        updatedAt: o.updatedAt.toISOString(),
      })),
    };
  }

  async listSellerOrders(sellerId: string, status?: string) {
    await this.assertActiveUser(sellerId);

    const where: any = { sellerId };
    if (status) where.status = status;

    const rows = await this.prisma.order.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        listing: { select: { id: true, title: true, coverPhotoUrl: true, priceCents: true, size: true, category: true } },
        buyer: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    return {
      items: rows.map((o) => ({
        id: o.id,
        status: o.status,
        totalCents: o.totalCents,
        currency: o.currency,
        listing: {
          id: o.listing.id,
          title: o.listing.title,
          coverPhotoUrl: o.listing.coverPhotoUrl ?? null,
          priceCents: o.listing.priceCents,
          size: o.listing.size ?? null,
          category: o.listing.category,
        },
        otherUser: {
          id: o.buyer.id,
          displayName: o.buyer.displayName,
          avatarUrl: o.buyer.avatarUrl ?? null,
        },
        updatedAt: o.updatedAt.toISOString(),
      })),
    };
  }

  async getOrderDetail(userId: string, orderId: string) {
    await this.assertActiveUser(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: { select: { id: true, title: true, coverPhotoUrl: true, priceCents: true, size: true, category: true } },
        buyer: { select: { id: true, displayName: true, avatarUrl: true } },
        seller: { select: { id: true, displayName: true, avatarUrl: true } },
        shipping: true, // if you have OrderShipping relation
      },
    });

    if (!order) throw new NotFoundException("Order not found");
    if (order.buyerId !== userId && order.sellerId !== userId) throw new ForbiddenException("Not your order");

    // Privacy: if seller viewing before payment, don’t reveal full address
    let shipping = order.shipping ?? null;
    const isSeller = order.sellerId === userId;
    if (isSeller && order.status === "pending_payment") {
      shipping = shipping
        ? {
            ...shipping,
            line1: null,
            line2: null,
            postalCode: null,
            name: null,
          }
        : null;
    }

    return {
      id: order.id,
      status: order.status,
      totalCents: order.totalCents,
      currency: order.currency,
      listing: order.listing,
      buyer: order.buyer,
      seller: order.seller,
      tracking: {
        carrier: order.trackingCarrier ?? null,
        trackingNumber: order.trackingNumber ?? null,
        shippedAt: order.shippedAt?.toISOString?.() ?? null,
      },
      shipping,
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  async attachShippingAddress(buyerId: string, orderId: string, addressId: string) {
    await this.assertActiveUser(buyerId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, buyerId: true, status: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.buyerId !== buyerId) throw new ForbiddenException("Only buyer can set shipping address");
    if (order.status !== "pending_payment") {
      throw new BadRequestException({ error: { code: "INVALID_STATE", message: "Shipping address must be set before payment" } });
    }

    const addr = await this.prisma.address.findUnique({
      where: { id: addressId },
      select: {
        id: true,
        userId: true,
        name: true,
        line1: true,
        line2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
      },
    });
    if (!addr || addr.userId !== buyerId) throw new ForbiddenException("Invalid address");

    // snapshot into OrderShipping (recommended)
    await this.prisma.orderShipping.upsert({
      where: { orderId },
      create: {
        orderId,
        name: addr.name,
        line1: addr.line1,
        line2: addr.line2,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country,
      },
      update: {
        name: addr.name,
        line1: addr.line1,
        line2: addr.line2,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country,
      },
    });

    return { ok: true };
  }

  async addTracking(
    sellerId: string,
    orderId: string,
    input: { carrier: string; trackingNumber: string },
  ) {
    await this.assertActiveUser(sellerId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, sellerId: true, status: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.sellerId !== sellerId) throw new ForbiddenException("Only seller can add tracking");

    // Guard: only after paid/processing
    if (!["processing", "paid"].includes(order.status)) {
      throw new BadRequestException({ error: { code: "INVALID_STATE", message: "Cannot add tracking yet" } });
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        trackingCarrier: input.carrier,
        trackingNumber: input.trackingNumber,
        shippedAt: new Date(),
        status: "shipped",
      },
      select: { id: true, status: true, trackingCarrier: true, trackingNumber: true, shippedAt: true },
    });

    return {
      orderId: updated.id,
      status: updated.status,
      carrier: updated.trackingCarrier,
      trackingNumber: updated.trackingNumber,
      shippedAt: updated.shippedAt?.toISOString?.() ?? null,
    };
  }
}
