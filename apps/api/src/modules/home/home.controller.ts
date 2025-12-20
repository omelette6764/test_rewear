import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/auth.guard";
import { CurrentUserId } from "../../common/auth/auth.decorator";
import { HomeService } from "./home.service";

@Controller("home")
@UseGuards(JwtAuthGuard)
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get("featured")
  async featured(@CurrentUserId() userId: string) {
    return await this.home.featured(userId);
  }
}