import { Controller, Post, UseGuards } from "@nestjs/common";
import { PayoutsService } from "./payouts.service";
import { AdminGuard } from "../admin/admin.guard";

@Controller("payouts")
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  // Manual trigger for ops / debugging (protected)
  @Post("release")
  @UseGuards(AdminGuard)
  async releaseNow() {
    const result = await this.payouts.releaseEligibleBatch({ limit: 50 });
    return { ok: true, ...result };
  }
}