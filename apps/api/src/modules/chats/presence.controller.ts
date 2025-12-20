import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/auth.guard";
import { PresenceService } from "./presence.service";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  @Get(":id/presence")
  async getPresence(@Param("id") userId: string) {
    return this.presence.getPresence(userId);
  }
}