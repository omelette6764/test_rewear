import { Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/auth.guard";
import { CurrentUserId } from "../../common/auth/auth.decorator";

import { FavoritesService } from "./favorites.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Post("listings/:id/favorite")
  async favorite(@CurrentUserId() userId: string, @Param("id") listingId: string) {
    return await this.favorites.favorite(userId, listingId);
  }

  @Delete("listings/:id/favorite")
  async unfavorite(@CurrentUserId() userId: string, @Param("id") listingId: string) {
    return await this.favorites.unfavorite(userId, listingId);
  }

  @Get("me/favorites")
  async myFavorites(
    @CurrentUserId() userId: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return await this.favorites.list(userId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }
}