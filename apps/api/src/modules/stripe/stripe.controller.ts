import { Controller, Headers, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { StripeService } from "./stripe.service";

@Controller("stripe")
export class StripeController {
  constructor(private readonly stripe: StripeService) {}

  /**
   * IMPORTANT: This must receive the RAW body.
   * In Nest, you typically configure rawBody for this route in main.ts.
   */
  @Post("webhook")
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers("stripe-signature") sig: string,
  ) {
    return await this.stripe.handleWebhook(req.rawBody ?? (req as any).body, sig);
  }
}