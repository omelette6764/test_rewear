import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/auth.guard";
import { CurrentUserId } from "../../common/auth/auth.decorator";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @CurrentUserId() userId: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.notifications.list(userId, {
      cursor: cursor ?? null,
      limit: Math.min(Number(limit ?? 30), 100),
    });
  }

  @Get("badge")
  async badge(@CurrentUserId() userId: string) {
    return this.notifications.badge(userId);
  }

  @Post(":id/read")
  async markRead(@CurrentUserId() userId: string, @Param("id") id: string) {
    return this.notifications.markRead(userId, id);
  }
}
