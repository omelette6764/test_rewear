import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { decodeCursor, encodeCursor } from "../../common/utils/cursor";

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertActiveUser(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { isBanned: true } });
    if (!u) throw new NotFoundException("User not found");
    if (u.isBanned) throw new ForbiddenException("Account disabled");
  }

  async favorite(userId: string, listingId: string) {
    await this.assertActiveUser(userId);

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, hiddenAt: true, status: true, seller: { select: { isBanned: true } } },
    });
    if (!listing || listing.hiddenAt || listing.seller.isBanned) {
      throw new NotFoundException("Listing not available");
    }

    await this.prisma.favorite.upsert({
      where: { userId_listingId: { userId, listingId } },
      create: { userId, listingId },
      update: {},
    });

    return { listingId, isFavorited: true };
  }

  async unfavorite(userId: string, listingId: string) {
    await this.assertActiveUser(userId);

    await this.prisma.favorite.deleteMany({
      where: { userId, listingId },
    });

    return { listingId, isFavorited: false };
  }

  async list(userId: string, q: { cursor?: string; limit?: number }) {
    await this.assertActiveUser(userId);

    const limit = Math.min(Math.max(q.limit ?? 20, 1), 50);
    const cursor = decodeCursor(q.cursor);

    const where: any = { userId };

    if (cursor) {
      where.OR = [
        { createdAt: { lt: new Date(cursor.createdAt) } },
        { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
      ];
    }

    const favs = await this.prisma.favorite.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
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

    // filter out favorites whose listings are no longer available
    const rows = favs.filter((f) => !!f.listing).map((f) => f.listing);

    const items = rows.map((l: any) => ({
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

    const lastFav = favs[favs.length - 1];
    const nextCursor = lastFav ? encodeCursor({ createdAt: lastFav.createdAt.toISOString(), id: lastFav.id }) : undefined;

    return { items, nextCursor };
  }
}