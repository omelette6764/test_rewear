import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/auth.guard";
import { CurrentUserId } from "../../common/auth/auth.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { ZCreateAddressInput, ZUpdateAddressInput } from "@rewear/shared";
import { AddressesService } from "./addresses.service";

@Controller("me/addresses")
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(ZCreateAddressInput)) body: any,
  ) {
    return await this.addresses.create(userId, body);
  }

  @Get()
  async list(@CurrentUserId() userId: string) {
    return await this.addresses.list(userId);
  }

  @Patch(":id")
  async update(
    @CurrentUserId() userId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ZUpdateAddressInput)) body: any,
  ) {
    return await this.addresses.update(userId, id, body);
  }

  @Delete(":id")
  async remove(@CurrentUserId() userId: string, @Param("id") id: string) {
    return await this.addresses.remove(userId, id);
  }

  @Post(":id/default")
  async makeDefault(@CurrentUserId() userId: string, @Param("id") id: string) {
    return await this.addresses.setDefault(userId, id);
  }
}
