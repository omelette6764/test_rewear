import { Module } from "@nestjs/common";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";
import { ListingsModule } from "../listings/listings.module";

@Module({
  imports: [ListingsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}