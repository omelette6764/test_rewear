import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { env } from "../../config/env";
import { PayoutsService } from "./payouts.service";

@Injectable()
export class PayoutsScheduler {
  private readonly log = new Logger(PayoutsScheduler.name);

  constructor(private readonly payouts: PayoutsService) {}

  /**
   * Every 10 minutes:
   * - release eligible payouts in small batches
   */
  @Cron("*/10 * * * *")
  async run() {
    const e = env();
    if (!e.CRON_ENABLED) return;

    const result = await this.payouts.releaseEligibleBatch({ limit: 25 });
    if (result.released || result.errors.length) {
      this.log.log(`Payout sweep: released=${result.released} skipped=${result.skipped} errors=${result.errors.length}`);
    }
  }
}