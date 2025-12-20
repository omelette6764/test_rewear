import { z } from "zod";
import { ZCents, ZId, ZIsoDateTime, ZCursor } from "./common";
import { ZUserPublic } from "./users";

export const ZCategory = z.enum(["tops", "bottoms", "shoes", "accessories", "other"]);

export const ZListingStatus = z.enum(["draft", "active", "sold", "archived", "hidden"]);

export const ZCondition = z.enum(["new", "like_new", "good", "fair", "poor"]);

export const ZListingPhoto = z.object({
  id: ZId,
  listingId: ZId,
  mediaId: ZId.nullable().optional(),
  url: z.string().url(),
  sortOrder: z.number().int().nonnegative(),
});

export const ZListingCard = z.object({
  id: ZId,
  title: z.string(),
  priceCents: ZCents,
  size: z.string().max(40).nullable(),
  category: ZCategory,
  status: ZListingStatus,
  coverPhotoUrl: z.string().url().nullable(),
  isFavorited: z.boolean(),
  seller: ZUserPublic,
  createdAt: ZIsoDateTime,
});

export const ZListingDetail = ZListingCard.extend({
  description: z.string().max(5000).nullable(),
  brand: z.string().max(80).nullable(),
  condition: ZCondition.nullable(),
  conditionScore10: z.number().int().min(1).max(10).nullable(),
  yearAcquired: z.number().int().min(1900).max(2100).nullable(),
  photos: z.array(ZListingPhoto),
});

export const ZCreateListingInput = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(5000).nullable().optional(),
  priceCents: ZCents,
  size: z.string().max(40).nullable().optional(),
  category: ZCategory,
  brand: z.string().max(80).nullable().optional(),
  condition: ZCondition.nullable().optional(),
  conditionScore10: z.number().int().min(1).max(10).nullable().optional(),
  yearAcquired: z.number().int().min(1900).max(2100).nullable().optional(),
  photoMediaIds: z.array(ZId).optional(), // attach uploaded media to listing photos
});

export const ZUpdateListingInput = ZCreateListingInput.partial();

export const ZExploreListingsQuery = z.object({
  q: z.string().max(120).optional(),
  category: ZCategory.optional(),
  minPriceCents: ZCents.optional(),
  maxPriceCents: ZCents.optional(),
  cursor: ZCursor,
  limit: z.number().int().min(1).max(50).optional(),
});

export const ZExploreListingsResponse = z.object({
  items: z.array(ZListingCard),
  nextCursor: ZCursor,
});

export type Category = z.infer<typeof ZCategory>;
export type ListingStatus = z.infer<typeof ZListingStatus>;
export type ListingPhoto = z.infer<typeof ZListingPhoto>;
export type ListingCard = z.infer<typeof ZListingCard>;
export type ListingDetail = z.infer<typeof ZListingDetail>;
export type CreateListingInput = z.infer<typeof ZCreateListingInput>;
export type UpdateListingInput = z.infer<typeof ZUpdateListingInput>;
export type ExploreListingsQuery = z.infer<typeof ZExploreListingsQuery>;
export type ExploreListingsResponse = z.infer<typeof ZExploreListingsResponse>;