import { z } from "zod";
import { ZCursor, ZId, ZIsoDateTime } from "./common";

export const ZReviewDirection = z.enum(["buyer_to_seller", "seller_to_buyer"]);

export const ZCreateReviewInput = z.object({
  orderId: ZId,
  direction: ZReviewDirection,
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

export const ZReview = z.object({
  id: ZId,
  orderId: ZId,
  reviewerId: ZId,
  revieweeId: ZId,
  direction: ZReviewDirection,
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  createdAt: ZIsoDateTime,
});

export const ZUserReviewsQuery = z.object({
  cursor: ZCursor,
  limit: z.number().int().min(1).max(50).optional(),
});

export const ZUserReviewsResponse = z.object({
  items: z.array(ZReview),
  nextCursor: ZCursor,
});

export const ZRatingSummary = z.object({
  userId: ZId,
  ratingAvg: z.number().min(0).max(5).nullable(),
  ratingCount: z.number().int().nonnegative(),
});

export type ReviewDirection = z.infer<typeof ZReviewDirection>;
export type CreateReviewInput = z.infer<typeof ZCreateReviewInput>;
export type Review = z.infer<typeof ZReview>;
export type UserReviewsQuery = z.infer<typeof ZUserReviewsQuery>;
export type UserReviewsResponse = z.infer<typeof ZUserReviewsResponse>;
export type RatingSummary = z.infer<typeof ZRatingSummary>;