import { Injectable } from "@nestjs/common";
import { ListingsService } from "../listings/listings.service";

@Injectable()
export class HomeService {
  constructor(private readonly listings: ListingsService) {}

  async featured(userId: string) {
    // Use the same logic as /listings/featured so both endpoints stay consistent.
    return await this.listings.getFeatured(userId);
  }
}