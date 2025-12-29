import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/auth.guard";
import { CurrentUserId } from "../../common/auth/auth.decorator";
import { RefundsService } from "./refunds.service";
import { AdminGuard } from "../admin/admin.guard";

@Controller("refunds")
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Get("orders/:orderId")
  @UseGuards(JwtAuthGuard)
  async byOrder(@CurrentUserId() userId: string, @Param("orderId") orderId: string) {
    return this.refunds.getRefundsForOrder(userId, orderId);
  }

  // Admin-only manual refund trigger (useful for ops)
  @Post("orders/:orderId")
  @UseGuards(AdminGuard)
  async adminRefund(@Param("orderId") orderId: string) {
    return this.refunds.createRefundForOrder({
      actorUserId: "admin",
      orderId,
      reason: "requested_by_customer",
      allowIfShipped: true, // admin override
    });
  }
}
