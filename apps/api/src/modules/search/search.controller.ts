import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/auth.guard";
import { CurrentUserId } from "../../common/auth/auth.decorator";
import { ZExploreListingsQuery } from "@rewear/shared";
import { SearchService } from "./search.service";

@Controller("search")
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  async searchListings(@CurrentUserId() userId: string, @Query() q: any) {
    const parsed = ZExploreListingsQuery.safeParse(q);
    if (!parsed.success) {
      return { items: [], nextCursor: undefined };
    }
    return await this.search.search(userId, parsed.data);
  }
}