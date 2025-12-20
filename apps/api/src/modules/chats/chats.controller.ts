import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/auth.guard";
import { CurrentUserId } from "../../common/auth/auth.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ChatsService } from "./chats.service";

// If you already have these Zod schemas in shared, keep yours and adjust imports.
// Minimal assumption:
import { ZCreateChatInput } from "@rewear/shared";

@Controller("chats")
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  @Get()
  async list(@CurrentUserId() userId: string) {
    return await this.chats.listChats(userId);
  }

  @Get(":id")
  async thread(@CurrentUserId() userId: string, @Param("id") chatId: string) {
    return await this.chats.getThread(userId, chatId);
  }

  /**
   * Find-or-create:
   * - Either direct chat with otherUserId
   * - Or listing chat: listingId (seller inferred), buyer is current user
   */
  @Post()
  async createOrFind(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(ZCreateChatInput)) body: any,
  ) {
    return await this.chats.findOrCreate(userId, body);
  }

  @Post(":id/read")
  async markRead(@CurrentUserId() userId: string, @Param("id") chatId: string) {
    return await this.chats.markRead(userId, chatId);
  }
}