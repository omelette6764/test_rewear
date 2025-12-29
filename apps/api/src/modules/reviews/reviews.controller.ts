import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/auth.guard";
import { CurrentUserId } from "../../common/auth/auth.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ReviewsService } from "./reviews.service";
import { z } from "zod";

const ZCreateReviewInput = z.object({
  orderId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post("reviews")
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(ZCreateReviewInput)) body: any,
  ) {
    return this.reviews.createReview(userId, body);
  }

  @Get("users/:id/reviews")
  async listForUser(
    // public endpoint
    @Query("userId") userId?: string,
  ) {
    // If you prefer REST param users/:id/reviews, adapt to your routing style.
    // Keeping minimal since you may already have this controller route elsewhere.
    if (!userId) return { items: [] };
    return this.reviews.listUserReviews(userId);
  }

  @Get("users/:id/rating-summary")
  async summary(@Query("userId") userId?: string) {
    if (!userId) return { ratingAvg: null, ratingCount: 0 };
    return this.reviews.getRatingSummary(userId);
  }
}
