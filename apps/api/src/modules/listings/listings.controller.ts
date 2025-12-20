import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/auth.guard";
import { CurrentUserId } from "../../common/auth/auth.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import {
  ZCreateListingInput,
  ZUpdateListingInput,
  ZExploreListingsQuery,
} from "@rewear/shared";
import { ListingsService } from "./listings.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  // ----- Home-style featured alias (optional; manifest lists both) -----
  @Get("listings/featured")
  async featured(@CurrentUserId() userId: string) {
    return await this.listings.getFeatured(userId);
  }

  // ----- Listing detail -----
  @Get("listings/:id")
  async detail(@CurrentUserId() userId: string, @Param("id") id: string) {
    return await this.listings.getDetail(userId, id);
  }

  // ----- Create / edit -----
  @Post("listings")
  async create(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(ZCreateListingInput)) body: any,
  ) {
    return await this.listings.create(userId, body);
  }

  @Patch("listings/:id")
  async update(
    @CurrentUserId() userId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ZUpdateListingInput)) body: any,
  ) {
    return await this.listings.update(userId, id, body);
  }

  @Post("listings/:id/publish")
  async publish(@CurrentUserId() userId: string, @Param("id") id: string) {
    return await this.listings.publish(userId, id);
  }

  @Post("listings/:id/archive")
  async archive(@CurrentUserId() userId: string, @Param("id") id: string) {
    return await this.listings.archive(userId, id);
  }

  // ----- Seller: My Listings -----
  @Get("me/listings")
  async myListings(
    @CurrentUserId() userId: string,
    @Query("status") status?: string,
  ) {
    return await this.listings.listMine(userId, status);
  }

  // ----- Explore listings (used by SearchModule too) -----
  @Get("listings/explore")
  async explore(@CurrentUserId() userId: string, @Query() q: any) {
    // validate query via shared schema
    const parsed = ZExploreListingsQuery.safeParse(q);
    if (!parsed.success) {
      return { items: [], nextCursor: undefined };
    }
    return await this.listings.explore(userId, parsed.data);
  }
}