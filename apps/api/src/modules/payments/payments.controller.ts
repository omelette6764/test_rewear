import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/auth.guard";
import { CurrentUserId } from "../../common/auth/auth.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { PaymentsService } from "./payments.service";

import { ZCreatePaymentIntentInput } from "@rewear/shared";

@Controller("payments")
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("create-intent")
  async createIntent(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(ZCreatePaymentIntentInput)) body: any,
  ) {
    return await this.payments.createPaymentIntent(userId, body.orderId);
  }
}