import { Module } from "@nestjs/common";
import { PayoutsController } from "./payouts.controller";
import { PayoutsService } from "./payouts.service";
import { PayoutsScheduler } from "./payouts.scheduler";

@Module({
  controllers: [PayoutsController],
  providers: [PayoutsService, PayoutsScheduler],
  exports: [PayoutsService],
})
export class PayoutsModule {}