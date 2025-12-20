import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { decodeCursor, encodeCursor } from "../../common/utils/cursor";

type CreateListingInput = {
  title: string;
  description?: string | null;
  priceCents: number;
  size?: string | null;
  category: "tops" | "bottoms" | "shoes" | "accessories" | "other";
  brand?: string | null;
  condition?: "new" | "like_new" | "good" | "fair" | "poor" | null;
  conditionScore10?: number | null;
  yearAcquired?: number | null;
  photoMediaIds?: string[];
};

type UpdateListingInput = Partial<CreateListingInput>;

type ExploreQuery = {
  q?: string;
  category?: "tops" | "bottoms" | "shoes" | "accessories" | "other";
  minPriceCents?: number;
  maxPriceCents?: number;
  cursor?: string;
  limit?: number;
};

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- helpers ----------
  private async assertActiveUser(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isBanned: true },
    });
    if (!u) throw new NotFoundException("User not found");
    if (u.isBanned) throw new ForbiddenException("Account disabled");
  }

  private async favoriteMap(userId: string, listingIds: string[]) {
    if (listingIds.length === 0) return new Map<string, boolean>();
    const favs = await this.prisma.favorite.findMany({
      where: { userId, listingId: { in: listingIds } },
      select: { listingId: true },
    });
    const set = new Set(favs.map((f) => f.listingId));
    return new Map(listingIds.map((id) => [id, set.has(id)]));
  }

  private listingCardFromDb(row: any, isFavorited: boolean) {
    const cover = row.coverPhotoUrl ?? row.photos?.[0]?.url ?? null;
    return {
      id: row.id,
      title: row.title,
      priceCents: row.priceCents,
      size: row.size ?? null,
      category: row.category,
      status: row.status,
      coverPhotoUrl: cover,
      isFavorited,
      seller: {
        id: row.seller.id,
        displayName: row.seller.displayName,
        avatarUrl: row.seller.avatarUrl ?? null,
        ratingAvg: row.seller.ratingAvg ?? null,
        ratingCount: row.seller.ratingCount ?? 0,
      },
      createdAt: row.createdAt.toISOString(),
    };
  }

  // ---------- featured ----------
  async getFeatured(userId: string) {
    await this.assertActiveUser(userId);

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const take = 12;

    // Popular by favorites (last 7 days)
    const popular = await this.prisma.favorite.groupBy({
      by: ["listingId"],
      where: { createdAt: { gte: since } },
      _count: { listingId: true },
      orderBy: { _count: { listingId: "desc" } },
      take,
    });

    const popularIds = popular.map((p) => p.listingId);

    const popularListings = popularIds.length
      ? await this.prisma.listing.findMany({
          where: {
            id: { in: popularIds },
            status: "active",
            hiddenAt: null,
            seller: { isBanned: false },
          },
          include: {
            seller: { select: { id: true, displayName: true, avatarUrl: true, ratingAvg: true, ratingCount: true } },
            photos: { orderBy: { sortOrder: "asc" }, take: 1 },
          },
        })
      : [];

    // Fill remaining with newest active
    const remaining = Math.max(0, take - popularListings.length);
    const newest = remaining
      ? await this.prisma.listing.findMany({
          where: {
            status: "active",
            hiddenAt: null,
            seller: { isBanned: false },
            ...(popularIds.length ? { id: { notIn: popularIds } } : {}),
          },
          orderBy: [{ createdAt: "desc" }],
          take: remaining,
          include: {
            seller: { select: { id: true, displayName: true, avatarUrl: true, ratingAvg: true, ratingCount: true } },
            photos: { orderBy: { sortOrder: "asc" }, take: 1 },
          },
        })
      : [];

    const merged = [...popularListings, ...newest];
    const favMap = await this.favoriteMap(userId, merged.map((l) => l.id));

    return {
      items: merged.map((l) => this.listingCardFromDb(l, favMap.get(l.id) ?? false)),
    };
  }

  // ---------- detail ----------
  async getDetail(userId: string, id: string) {
    await this.assertActiveUser(userId);

    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        seller: {
          select: { id: true, displayName: true, avatarUrl: true, ratingAvg: true, ratingCount: true, isBanned: true },
        },
        photos: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, listingId: true, mediaId: true, url: true, sortOrder: true },
        },
      },
    });

    if (!listing) throw new NotFoundException("Listing not found");
    if (listing.hiddenAt) throw new NotFoundException("Listing not available");
    if (listing.seller.isBanned) throw new NotFoundException("Listing not available");

    const isFavorited = await this.prisma.favorite.findUnique({
      where: { userId_listingId: { userId, listingId: id } },
      select: { id: true },
    });

    const cover = listing.coverPhotoUrl ?? listing.photos?.[0]?.url ?? null;

    return {
      id: listing.id,
      title: listing.title,
      priceCents: listing.priceCents,
      size: listing.size ?? null,
      category: listing.category,
      status: listing.status,
      coverPhotoUrl: cover,
      isFavorited: !!isFavorited,
      seller: {
        id: listing.seller.id,
        displayName: listing.seller.displayName,
        avatarUrl: listing.seller.avatarUrl ?? null,
        ratingAvg: listing.seller.ratingAvg ?? null,
        ratingCount: listing.seller.ratingCount ?? 0,
      },
      createdAt: listing.createdAt.toISOString(),
      description: listing.description ?? null,
      brand: listing.brand ?? null,
      condition: listing.condition ?? null,
      conditionScore10: listing.conditionScore10 ?? null,
      yearAcquired: listing.yearAcquired ?? null,
      photos: listing.photos,
    };
  }

  // ---------- create ----------
  async create(userId: string, input: CreateListingInput) {
    await this.assertActiveUser(userId);

    const mediaIds = input.photoMediaIds ?? [];
    const media = mediaIds.length
      ? await this.prisma.media.findMany({
          where: { id: { in: mediaIds }, userId },
          select: { id: true, url: true },
        })
      : [];

    const photosData = media.map((m, idx) => ({
      mediaId: m.id,
      url: m.url,
      sortOrder: idx,
    }));

    const coverPhotoUrl = photosData[0]?.url ?? null;

    const listing = await this.prisma.listing.create({
      data: {
        sellerId: userId,
        title: input.title,
        description: input.description ?? null,
        priceCents: input.priceCents,
        size: input.size ?? null,
        category: input.category,
        brand: input.brand ?? null,
        condition: input.condition ?? null,
        conditionScore10: input.conditionScore10 ?? null,
        yearAcquired: input.yearAcquired ?? null,
        coverPhotoUrl,
        status: "draft",
        photos: photosData.length ? { create: photosData } : undefined,
      },
      include: {
        seller: { select: { id: true, displayName: true, avatarUrl: true, ratingAvg: true, ratingCount: true } },
        photos: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    });

    return this.listingCardFromDb(listing, false);
  }

  // ---------- update ----------
  async update(userId: string, id: string, input: UpdateListingInput) {
    await this.assertActiveUser(userId);

    const existing = await this.prisma.listing.findUnique({
      where: { id },
      select: { id: true, sellerId: true, status: true, hiddenAt: true },
    });
    if (!existing) throw new NotFoundException("Listing not found");
    if (existing.hiddenAt) throw new NotFoundException("Listing not available");
    if (existing.sellerId !== userId) throw new ForbiddenException("Not your listing");

    // For MVP: allow editing in draft/active only
    if (!["draft", "active"].includes(existing.status)) {
      throw new BadRequestException({
        error: { code: "INVALID_STATE", message: "Listing cannot be edited in this state" },
      });
    }

    // Optional: attach new photos from media ids (replaces existing photos if provided)
    let replacePhotos: any = undefined;
    if (input.photoMediaIds) {
      const media = await this.prisma.media.findMany({
        where: { id: { in: input.photoMediaIds }, userId },
        select: { id: true, url: true },
      });

      replacePhotos = media.map((m, idx) => ({
        mediaId: m.id,
        url: m.url,
        sortOrder: idx,
      }));
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (replacePhotos) {
        await tx.listingPhoto.deleteMany({ where: { listingId: id } });
      }

      const coverPhotoUrl =
        replacePhotos?.[0]?.url ??
        (await tx.listingPhoto.findFirst({
          where: { listingId: id },
          orderBy: { sortOrder: "asc" },
          select: { url: true },
        }))?.url ??
        null;

      const row = await tx.listing.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description ?? null } : {}),
          ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
          ...(input.size !== undefined ? { size: input.size ?? null } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.brand !== undefined ? { brand: input.brand ?? null } : {}),
          ...(input.condition !== undefined ? { condition: input.condition ?? null } : {}),
          ...(input.conditionScore10 !== undefined ? { conditionScore10: input.conditionScore10 ?? null } : {}),
          ...(input.yearAcquired !== undefined ? { yearAcquired: input.yearAcquired ?? null } : {}),
          coverPhotoUrl,
          ...(replacePhotos ? { photos: { create: replacePhotos } } : {}),
        },
        include: {
          seller: { select: { id: true, displayName: true, avatarUrl: true, ratingAvg: true, ratingCount: true } },
          photos: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
      });

      return row;
    });

    // recompute favorite flag
    const fav = await this.prisma.favorite.findUnique({
      where: { userId_listingId: { userId, listingId: id } },
      select: { id: true },
    });

    return this.listingCardFromDb(updated, !!fav);
  }

  // ---------- publish / archive ----------
  async publish(userId: string, id: string) {
    await this.assertActiveUser(userId);

    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: { id: true, sellerId: true, status: true, hiddenAt: true },
    });
    if (!listing) throw new NotFoundException("Listing not found");
    if (listing.hiddenAt) throw new NotFoundException("Listing not available");
    if (listing.sellerId !== userId) throw new ForbiddenException("Not your listing");

    if (listing.status !== "draft") {
      throw new BadRequestException({ error: { code: "INVALID_STATE", message: "Only draft listings can be published" } });
    }

    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status: "active" },
      include: {
        seller: { select: { id: true, displayName: true, avatarUrl: true, ratingAvg: true, ratingCount: true } },
        photos: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    });

    const fav = await this.prisma.favorite.findUnique({
      where: { userId_listingId: { userId, listingId: id } },
      select: { id: true },
    });

    return this.listingCardFromDb(updated, !!fav);
  }

  async archive(userId: string, id: string) {
    await this.assertActiveUser(userId);

    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: { id: true, sellerId: true, status: true, hiddenAt: true },
    });
    if (!listing) throw new NotFoundException("Listing not found");
    if (listing.hiddenAt) throw new NotFoundException("Listing not available");
    if (listing.sellerId !== userId) throw new ForbiddenException("Not your listing");

    if (!["active", "sold", "draft"].includes(listing.status)) {
      throw new BadRequestException({ error: { code: "INVALID_STATE", message: "Listing cannot be archived" } });
    }

    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status: "archived" },
      include: {
        seller: { select: { id: true, displayName: true, avatarUrl: true, ratingAvg: true, ratingCount: true } },
        photos: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    });

    const fav = await this.prisma.favorite.findUnique({
      where: { userId_listingId: { userId, listingId: id } },
      select: { id: true },
    });

    return this.listingCardFromDb(updated, !!fav);
  }

  // ---------- my listings ----------
  async listMine(userId: string, status?: string) {
    await this.assertActiveUser(userId);

    const where: any = { sellerId: userId, hiddenAt: null };
    if (status) where.status = status;

    const rows = await this.prisma.listing.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        seller: { select: { id: true, displayName: true, avatarUrl: true, ratingAvg: true, ratingCount: true } },
        photos: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
      take: 100,
    });

    // For "my listings", we still show whether you favorited your own listing (rare but fine)
    const favMap = await this.favoriteMap(userId, rows.map((r) => r.id));
    return { items: rows.map((r) => this.listingCardFromDb(r, favMap.get(r.id) ?? false)) };
  }

  // ---------- explore ----------
  async explore(userId: string, query: ExploreQuery) {
    await this.assertActiveUser(userId);

    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const cursor = decodeCursor(query.cursor);

    const where: any = {
      status: "active",
      hiddenAt: null,
      seller: { isBanned: false },
      // don't show your own listings by default
      NOT: { sellerId: userId },
    };

    if (query.category) where.category = query.category;
    if (query.minPriceCents !== undefined) where.priceCents = { ...(where.priceCents ?? {}), gte: query.minPriceCents };
    if (query.maxPriceCents !== undefined) where.priceCents = { ...(where.priceCents ?? {}), lte: query.maxPriceCents };

    if (query.q) {
      // lightweight MVP search: title OR brand
      where.OR = [
        { title: { contains: query.q, mode: "insensitive" } },
        { brand: { contains: query.q, mode: "insensitive" } },
      ];
    }

    // Cursor: (createdAt,id) desc
    if (cursor) {
      where.OR = [
        ...(where.OR ?? []),
        {
          createdAt: { lt: new Date(cursor.createdAt) },
        },
        {
          createdAt: new Date(cursor.createdAt),
          id: { lt: cursor.id },
        },
      ];
    }

    const rows = await this.prisma.listing.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      include: {
        seller: { select: { id: true, displayName: true, avatarUrl: true, ratingAvg: true, ratingCount: true } },
        photos: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    });

    const favMap = await this.favoriteMap(userId, rows.map((r) => r.id));
    const items = rows.map((r) => this.listingCardFromDb(r, favMap.get(r.id) ?? false));

    const last = rows[rows.length - 1];
    const nextCursor = last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : undefined;

    return { items, nextCursor };
  }
}