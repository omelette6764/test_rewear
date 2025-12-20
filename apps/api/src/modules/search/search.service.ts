import { Injectable } from "@nestjs/common";
import { ListingsService } from "../listings/listings.service";

@Injectable()
export class SearchService {
  constructor(private readonly listings: ListingsService) {}

  async search(userId: string, query: any) {
    return await this.listings.explore(userId, query);
  }
}