import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/auth.guard";
import { CurrentUserId } from "../../common/auth/auth.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { ZUpdateMeInput } from "@rewear/shared";
import { UsersService } from "./users.service";

@Controller("me")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async getMe(@CurrentUserId() userId: string) {
    return await this.users.getMe(userId);
  }

  @Patch()
  async updateMe(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(ZUpdateMeInput)) body: any,
  ) {
    return await this.users.updateMe(userId, body);
  }

  @Get("activity/summary")
  async activitySummary(@CurrentUserId() userId: string) {
    return await this.users.getActivitySummary(userId);
  }
}
