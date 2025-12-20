import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";
import { env } from "../../../config/env";
import { ChatsService } from "../chats.service";
import { PresenceService } from "../presence.service";

type WsAuthPayload = { sub: string; email?: string };

@WebSocketGateway({
  namespace: "/v1/ws",
  cors: { origin: true, credentials: true },
})
export class ChatsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly chats: ChatsService,
    private readonly presence: PresenceService,
  ) {}

  private getToken(socket: Socket): string | null {
    const authToken = (socket.handshake.auth as any)?.token;
    if (typeof authToken === "string" && authToken.length > 0) return authToken;

    const hdr = socket.handshake.headers["authorization"];
    if (typeof hdr === "string" && hdr.toLowerCase().startsWith("bearer ")) {
      return hdr.slice(7).trim();
    }
    return null;
  }

  private getUserId(socket: Socket): string {
    return (socket.data as any).userId as string;
  }

  async handleConnection(socket: Socket) {
    const token = this.getToken(socket);
    if (!token) {
      socket.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<WsAuthPayload>(token, {
        secret: env().JWT_SECRET,
      });

      const userId = payload.sub;
      if (!userId) {
        socket.disconnect(true);
        return;
      }

      (socket.data as any).userId = userId;

      // Join a per-user room (for targeted events)
      socket.join(`user:${userId}`);

      // Mark presence and broadcast update
      this.presence.notePing(userId);
      const pres = this.presence.getPresence(userId);
      this.server.emit("presence.update", pres);
    } catch {
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    // We don’t instantly mark offline; presence decays based on last ping.
    // This avoids flapping on mobile networks.
  }

  // Client can ping every ~20–30s while foregrounded
  @SubscribeMessage("presence.ping")
  async onPresencePing(@ConnectedSocket() socket: Socket) {
    const userId = this.getUserId(socket);
    if (!userId) return;

    this.presence.notePing(userId);
    const pres = this.presence.getPresence(userId);
    this.server.emit("presence.update", pres);

    return pres;
  }

  /**
   * Client sends:
   * { chatId, text?: string, mediaIds?: string[] }
   */
  @SubscribeMessage("chat.send")
  async onChatSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: any,
  ) {
    const userId = this.getUserId(socket);
    if (!userId) return;

    // Ensure sender is in chat room so they receive echoes consistently
    if (typeof body?.chatId === "string") {
      socket.join(`chat:${body.chatId}`);
    }

    const message = await this.chats.sendMessage(userId, {
      chatId: body.chatId,
      text: body.text,
      mediaIds: body.mediaIds,
    });

    // Broadcast to everyone in chat room
    this.server.to(`chat:${body.chatId}`).emit("message.new", message);

    // Also broadcast to the other participant's user room (for chat list updates / push hooks later)
    if (message.otherUserId) {
      this.server.to(`user:${message.otherUserId}`).emit("message.new", message);
    }

    return message;
  }

  /**
   * Client sends:
   * { chatId }
   * Server:
   * - marks read in DB
   * - broadcasts chat.read to chat room + other user room
   */
  @SubscribeMessage("chat.read")
  async onChatRead(@ConnectedSocket() socket: Socket, @MessageBody() body: any) {
    const userId = this.getUserId(socket);
    if (!userId) return;

    const chatId = body?.chatId as string;
    if (!chatId) return;

    socket.join(`chat:${chatId}`);

    const result = await this.chats.markRead(userId, chatId);
    const payload = { chatId, userId, lastReadAt: result.lastReadAt };

    this.server.to(`chat:${chatId}`).emit("chat.read", payload);
    this.server.emit("chat.read", payload);

    return payload;
  }
}