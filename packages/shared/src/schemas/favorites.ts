import { z } from "zod";
import { ZId, ZCursor } from "./common";
import { ZListingCard } from "./listings";

export const ZFavoriteToggleResponse = z.object({
  listingId: ZId,
  isFavorited: z.boolean(),
});

export const ZMyFavoritesQuery = z.object({
  cursor: ZCursor,
  limit: z.number().int().min(1).max(50).optional(),
});

export const ZMyFavoritesResponse = z.object({
  items: z.array(ZListingCard),
  nextCursor: ZCursor,
});

export type FavoriteToggleResponse = z.infer<typeof ZFavoriteToggleResponse>;
export type MyFavoritesQuery = z.infer<typeof ZMyFavoritesQuery>;
export type MyFavoritesResponse = z.infer<typeof ZMyFavoritesResponse>;