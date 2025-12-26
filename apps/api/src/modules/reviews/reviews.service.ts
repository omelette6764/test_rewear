import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(
    reviewerId: string,
    input: { orderId: string; rating: number; comment?: string },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        status: true,
        buyerId: true,
        sellerId: true,
      },
    });
    if (!order) throw new NotFoundException("Order not found");

    // Only buyer can review seller in v1 (simple + common marketplace rule)
    if (order.buyerId !== reviewerId) throw new ForbiddenException("Only buyer can review");

    if (order.status !== "completed") {
      throw new BadRequestException({
        error: { code: "INVALID_STATE", message: "Order must be completed before reviewing" },
      });
    }

    // One review per order
    const existing = await this.prisma.review.findUnique({
      where: { orderId: order.id },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException({
        error: { code: "ALREADY_REVIEWED", message: "Review already exists for this order" },
      });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const r = await tx.review.create({
        data: {
          orderId: order.id,
          reviewerId,
          revieweeId: order.sellerId,
          rating: input.rating,
          comment: input.comment?.trim() || null,
        },
        select: { id: true, orderId: true, rating: true, comment: true, createdAt: true, revieweeId: true },
      });

      // Update aggregates on seller
      const agg = await tx.review.aggregate({
        where: { revieweeId: order.sellerId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.user.update({
        where: { id: order.sellerId },
        data: {
          ratingAvg: agg._avg.rating ?? null,
          ratingCount: agg._count.rating ?? 0,
        },
      });

      return r;
    });

    return {
      ok: true as const,
      review: {
        id: created.id,
        orderId: created.orderId,
        rating: created.rating,
        comment: created.comment,
        createdAt: created.createdAt.toISOString(),
      },
    };
  }

  async listUserReviews(userId: string) {
    const rows = await this.prisma.review.findMany({
      where: { revieweeId: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        reviewer: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    return {
      items: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
        reviewer: {
          id: r.reviewer.id,
          displayName: r.reviewer.displayName,
          avatarUrl: r.reviewer.avatarUrl ?? null,
        },
      })),
    };
  }

  async getRatingSummary(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ratingAvg: true, ratingCount: true },
    });
    if (!u) return { ratingAvg: null, ratingCount: 0 };
    return { ratingAvg: u.ratingAvg ?? null, ratingCount: u.ratingCount ?? 0 };
  }
}
