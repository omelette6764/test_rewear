import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/auth.guard";
import { CurrentUserId } from "../../common/auth/auth.decorator";
import { ActivityService } from "./activity.service";

@Controller("me/activity")
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  async getAll(
    @CurrentUserId() userId: string,
    @Query("chatsCursor") chatsCursor?: string,
    @Query("likesCursor") likesCursor?: string,
    @Query("ordersCursor") ordersCursor?: string,
  ) {
    return await this.activity.getAll(userId, { chatsCursor, likesCursor, ordersCursor });
  }
}