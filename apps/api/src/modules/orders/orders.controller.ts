import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/auth.guard";
import { CurrentUserId } from "../../common/auth/auth.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { OrdersService } from "./orders.service";

import { ZAttachShippingAddressInput, ZAddTrackingInput } from "@rewear/shared";

@Controller()
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get("me/orders")
  async myOrders(
    @CurrentUserId() userId: string,
    @Query("status") status?: string,
  ) {
    return await this.orders.listBuyerOrders(userId, status);
  }

  @Get("me/sales/orders")
  async mySales(
    @CurrentUserId() userId: string,
    @Query("status") status?: string,
  ) {
    return await this.orders.listSellerOrders(userId, status);
  }

  @Get("orders/:id")
  async detail(@CurrentUserId() userId: string, @Param("id") orderId: string) {
    return await this.orders.getOrderDetail(userId, orderId);
  }

  @Post("orders/:id/shipping-address")
  async attachShipping(
    @CurrentUserId() userId: string,
    @Param("id") orderId: string,
    @Body(new ZodValidationPipe(ZAttachShippingAddressInput)) body: any,
  ) {
    return await this.orders.attachShippingAddress(userId, orderId, body.addressId);
  }

  @Post("orders/:id/tracking")
  async addTracking(
    @CurrentUserId() userId: string,
    @Param("id") orderId: string,
    @Body(new ZodValidationPipe(ZAddTrackingInput)) body: any,
  ) {
    return await this.orders.addTracking(userId, orderId, body);
  }
}