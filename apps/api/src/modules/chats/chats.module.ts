import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { env } from "../../config/env";
import { ChatsController } from "./chats.controller";
import { ChatsService } from "./chats.service";
import { PresenceController } from "./presence.controller";
import { PresenceService } from "./presence.service";
import { ChatsGateway } from "./ws/chats.gateway";

@Module({
  imports: [
    JwtModule.register({
      secret: env().JWT_SECRET,
    }),
  ],
  controllers: [ChatsController, PresenceController],
  providers: [ChatsService, PresenceService, ChatsGateway],
  exports: [ChatsService, PresenceService],
})
export class ChatsModule {}