import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/auth.guard";
import { CurrentUserId } from "../../common/auth/auth.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CheckoutService } from "./checkout.service";

import { ZCheckoutStartInput } from "@rewear/shared";

@Controller("checkout")
@UseGuards(JwtAuthGuard)
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post("start")
  async start(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(ZCheckoutStartInput)) body: any,
  ) {
    return await this.checkout.start(userId, body.listingId);
  }

  @Get(":orderId/status")
  async status(@CurrentUserId() userId: string, @Param("orderId") orderId: string) {
    return await this.checkout.status(userId, orderId);
  }

  @Post(":orderId/cancel")
  async cancel(@CurrentUserId() userId: string, @Param("orderId") orderId: string) {
    return await this.checkout.cancel(userId, orderId);
  }
}