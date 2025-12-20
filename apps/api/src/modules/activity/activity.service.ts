import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { decodeCursor, encodeCursor } from "../../common/utils/cursor";

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertActiveUser(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { isBanned: true } });
    if (!u) throw new NotFoundException("User not found");
    if (u.isBanned) throw new ForbiddenException("Account disabled");
  }

  async getAll(
    userId: string,
    cursors: { chatsCursor?: string; likesCursor?: string; ordersCursor?: string },
  ) {
    await this.assertActiveUser(userId);

    const [chats, likes, orders] = await Promise.all([
      this.getChats(userId, cursors.chatsCursor),
      this.getLikes(userId, cursors.likesCursor),
      this.getOrders(userId, cursors.ordersCursor),
    ]);

    return { chats, likes, orders };
  }

  private async getChats(userId: string, cursor?: string) {
    const take = 10;
    const c = decodeCursor(cursor);

    const where: any = { userId };
    if (c) {
      where.OR = [
        { createdAt: { lt: new Date(c.createdAt) } },
        { createdAt: new Date(c.createdAt), id: { lt: c.id } },
      ];
    }

    const parts = await this.prisma.chatParticipant.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      include: {
        chat: {
          include: {
            participants: { include: { user: { select: { id: true, displayName: true, avatarUrl: true, ratingAvg: true, ratingCount: true } } } },
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    });

    const items = parts.map((p) => {
      const other = p.chat.participants.find((cp) => cp.userId !== userId)?.user;
      const last = p.chat.messages[0];
      return {
        chatId: p.chatId,
        otherUserId: other?.id ?? "",
        otherDisplayName: other?.displayName ?? "User",
        otherAvatarUrl: other?.avatarUrl ?? null,
        lastMessagePreview: last?.text ?? null,
        lastMessageAt: last?.createdAt?.toISOString?.() ?? null,
        unreadCount: p.unreadCount ?? 0,
      };
    });

    const last = parts[parts.length - 1];
    const nextCursor = last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : undefined;

    return { items, nextCursor };
  }

  private async getLikes(userId: string, cursor?: string) {
    const take = 10;
    const c = decodeCursor(cursor);

    const where: any = { userId };
    if (c) {
      where.OR = [
        { createdAt: { lt: new Date(c.createdAt) } },
        { createdAt: new Date(c.createdAt), id: { lt: c.id } },
      ];
    }

    const favs = await this.prisma.favorite.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      include: {
        listing: {
          where: { status: "active", hiddenAt: null, seller: { isBanned: false } },
          include: {
            seller: { select: { id: true, displayName: true, avatarUrl: true, ratingAvg: true, ratingCount: true } },
            photos: { orderBy: { sortOrder: "asc" }, take: 1 },
          },
        },
      },
    });

    const listings = favs.filter((f) => !!f.listing).map((f) => f.listing);

    const items = listings.map((l: any) => ({
      id: l.id,
      title: l.title,
      priceCents: l.priceCents,
      size: l.size ?? null,
      category: l.category,
      status: l.status,
      coverPhotoUrl: l.coverPhotoUrl ?? l.photos?.[0]?.url ?? null,
      isFavorited: true,
      seller: {
        id: l.seller.id,
        displayName: l.seller.displayName,
        avatarUrl: l.seller.avatarUrl ?? null,
        ratingAvg: l.seller.ratingAvg ?? null,
        ratingCount: l.seller.ratingCount ?? 0,
      },
      createdAt: l.createdAt.toISOString(),
    }));

    const last = favs[favs.length - 1];
    const nextCursor = last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : undefined;

    return { items, nextCursor };
  }

  private async getOrders(userId: string, cursor?: string) {
    const take = 10;
    const c = decodeCursor(cursor);

    const where: any = {
      OR: [{ buyerId: userId }, { sellerId: userId }],
    };

    if (c) {
      where.OR = [
        ...where.OR,
        { updatedAt: { lt: new Date(c.createdAt) } },
        { updatedAt: new Date(c.createdAt), id: { lt: c.id } },
      ];
    }

    const rows = await this.prisma.order.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take,
      include: {
        listing: {
          include: {
            seller: { select: { id: true, displayName: true, avatarUrl: true, ratingAvg: true, ratingCount: true } },
            photos: { orderBy: { sortOrder: "asc" }, take: 1 },
          },
        },
      },
    });

    // For activity list, we show listing card-ish data, but with order status.
    const items = rows.map((o: any) => ({
      orderId: o.id,
      listing: {
        id: o.listing.id,
        title: o.listing.title,
        priceCents: o.listing.priceCents,
        size: o.listing.size ?? null,
        category: o.listing.category,
        status: o.listing.status,
        coverPhotoUrl: o.listing.coverPhotoUrl ?? o.listing.photos?.[0]?.url ?? null,
        isFavorited: false,
        seller: {
          id: o.listing.seller.id,
          displayName: o.listing.seller.displayName,
          avatarUrl: o.listing.seller.avatarUrl ?? null,
          ratingAvg: o.listing.seller.ratingAvg ?? null,
          ratingCount: o.listing.seller.ratingCount ?? 0,
        },
        createdAt: o.listing.createdAt.toISOString(),
      },
      status: o.status,
      updatedAt: o.updatedAt.toISOString(),
    }));

    const last = rows[rows.length - 1];
    const nextCursor = last ? encodeCursor({ createdAt: last.updatedAt.toISOString(), id: last.id }) : undefined;

    return { items, nextCursor };
  }
}