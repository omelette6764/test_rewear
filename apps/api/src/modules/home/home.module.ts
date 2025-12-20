import { Module } from "@nestjs/common";
import { HomeController } from "./home.controller";
import { HomeService } from "./home.service";
import { ListingsModule } from "../listings/listings.module";

@Module({
  imports: [ListingsModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}