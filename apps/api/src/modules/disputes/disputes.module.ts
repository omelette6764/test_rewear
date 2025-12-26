import { Module } from "@nestjs/common";
import { DisputesService } from "./disputes.service";

@Module({
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
