import { z } from "zod";
import { ZCursor } from "./common";
import { ZListingCard } from "./listings";

export const ZRecommendationsQuery = z.object({
  cursor: ZCursor,
  limit: z.number().int().min(1).max(50).optional(),
});

export const ZRecommendationsResponse = z.object({
  items: z.array(ZListingCard),
  nextCursor: ZCursor,
});

export type RecommendationsQuery = z.infer<typeof ZRecommendationsQuery>;
export type RecommendationsResponse = z.infer<typeof ZRecommendationsResponse>;