import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type CreateChatInput =
  | { otherUserId: string; listingId?: string | null }
  | { listingId: string; otherUserId?: string | null };

type SendMessageInput = {
  chatId: string;
  text?: string | null;
  mediaIds?: string[] | null;
};

@Injectable()
export class ChatsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertActiveUser(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isBanned: true },
    });
    if (!u) throw new NotFoundException("User not found");
    if (u.isBanned) throw new ForbiddenException("Account disabled");
  }

  private async assertNotBlocked(a: string, b: string) {
    // Block is directional; deny if either direction exists
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
      select: { id: true },
    });
    if (block) throw new ForbiddenException("User is blocked");
  }

  private async requireParticipant(userId: string, chatId: string) {
    const part = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
      select: {
        chatId: true,
        userId: true,
        lastReadAt: true,
        unreadCount: true,
        chat: {
          select: {
            id: true,
            listingId: true,
            createdAt: true,
            participants: {
              select: {
                userId: true,
                lastReadAt: true,
                unreadCount: true,
                user: { select: { id: true, displayName: true, avatarUrl: true, ratingAvg: true, ratingCount: true, isBanned: true } },
              },
            },
          },
        },
      },
    });

    if (!part) throw new NotFoundException("Chat not found");
    return part;
  }

  // ---------------- REST: list chats ----------------

  async listChats(userId: string) {
    await this.assertActiveUser(userId);

    const parts = await this.prisma.chatParticipant.findMany({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        chat: {
          include: {
            participants: {
              include: {
                user: { select: { id: true, displayName: true, avatarUrl: true, ratingAvg: true, ratingCount: true, isBanned: true } },
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { attachments: true },
            },
          },
        },
      },
      take: 200,
    });

    const items = parts
      .map((p) => {
        const other = p.chat.participants.find((cp) => cp.userId !== userId)?.user;
        if (!other || other.isBanned) return null; // hide chats with banned user for MVP
        const last = p.chat.messages[0];

        return {
          chatId: p.chatId,
          listingId: p.chat.listingId ?? null,
          otherUser: {
            id: other.id,
            displayName: other.displayName,
            avatarUrl: other.avatarUrl ?? null,
            ratingAvg: other.ratingAvg ?? null,
            ratingCount: other.ratingCount ?? 0,
          },
          unreadCount: p.unreadCount ?? 0,
          lastMessage: last
            ? {
                id: last.id,
                text: last.text ?? null,
                kind: last.kind,
                createdAt: last.createdAt.toISOString(),
                hasImage: (last.attachments?.length ?? 0) > 0,
              }
            : null,
          updatedAt: (p.updatedAt ?? p.createdAt).toISOString(),
        };
      })
      .filter(Boolean);

    return { items };
  }

  // ---------------- REST: get thread ----------------

  async getThread(userId: string, chatId: string) {
    await this.assertActiveUser(userId);

    const part = await this.requireParticipant(userId, chatId);

    const chat = part.chat;
    const otherPart = chat.participants.find((cp) => cp.userId !== userId);
    const otherUser = otherPart?.user;

    if (!otherUser || otherUser.isBanned) throw new NotFoundException("Chat not found");

    // block check
    await this.assertNotBlocked(userId, otherUser.id);

    const messages = await this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
      take: 100, // MVP
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
        attachments: {
          include: {
            media: { select: { id: true, url: true, contentType: true, sizeBytes: true, uploadedAt: true, kind: true } },
          },
        },
      },
    });

    const otherLastReadAt = otherPart?.lastReadAt ?? null;

    const messageDtos = messages.map((m) => {
      const isReadByOther =
        otherLastReadAt ? m.createdAt <= otherLastReadAt : false;

      return {
        id: m.id,
        chatId: m.chatId,
        senderId: m.senderId,
        kind: m.kind,
        text: m.text ?? null,
        createdAt: m.createdAt.toISOString(),
        isReadByOther,
        attachments: (m.attachments ?? []).map((a) => ({
          id: a.id,
          mediaId: a.mediaId,
          url: a.media?.url ?? null,
          contentType: a.media?.contentType ?? null,
        })),
      };
    });

    return {
      chatId: chat.id,
      listingId: chat.listingId ?? null,
      me: { userId },
      other: {
        userId: otherUser.id,
        displayName: otherUser.displayName,
        avatarUrl: otherUser.avatarUrl ?? null,
        ratingAvg: otherUser.ratingAvg ?? null,
        ratingCount: otherUser.ratingCount ?? 0,
      },
      readState: {
        myLastReadAt: part.lastReadAt?.toISOString?.() ?? null,
        otherLastReadAt: otherLastReadAt?.toISOString?.() ?? null,
      },
      messages: messageDtos,
    };
  }

  // ---------------- REST: find-or-create ----------------

  async findOrCreate(userId: string, input: CreateChatInput) {
    await this.assertActiveUser(userId);

    const listingId = (input as any).listingId ?? null;
    let otherUserId = (input as any).otherUserId ?? null;

    if (!listingId && !otherUserId) {
      throw new BadRequestException({
        error: { code: "INVALID_INPUT", message: "Provide otherUserId or listingId" },
      });
    }

    if (listingId) {
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
        select: { id: true, sellerId: true, hiddenAt: true, status: true, seller: { select: { isBanned: true } } },
      });
      if (!listing || listing.hiddenAt || listing.seller.isBanned) {
        throw new NotFoundException("Listing not available");
      }
      // Messaging seller from listing: other = seller
      otherUserId = listing.sellerId;
      if (otherUserId === userId) {
        throw new BadRequestException({
          error: { code: "INVALID_INPUT", message: "Cannot chat with yourself" },
        });
      }
    }

    if (!otherUserId) {
      throw new BadRequestException({
        error: { code: "INVALID_INPUT", message: "Missing otherUserId" },
      });
    }

    await this.assertNotBlocked(userId, otherUserId);

    const existing = await this.prisma.chat.findFirst({
      where: {
        listingId: listingId ?? null,
        participants: {
          every: { userId: { in: [userId, otherUserId] } },
        },
      },
      select: { id: true },
    });

    if (existing) return { chatId: existing.id };

    const created = await this.prisma.$transaction(async (tx) => {
      const chat = await tx.chat.create({
        data: {
          listingId: listingId ?? null,
          participants: {
            create: [
              { userId, unreadCount: 0 },
              { userId: otherUserId, unreadCount: 0 },
            ],
          },
        },
        select: { id: true },
      });

      return chat;
    });

    return { chatId: created.id };
  }

  // ---------------- REST: mark read ----------------

  async markRead(userId: string, chatId: string) {
    await this.assertActiveUser(userId);

    const part = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
      select: { chatId: true, userId: true },
    });
    if (!part) throw new NotFoundException("Chat not found");

    const now = new Date();
    await this.prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId } },
      data: { lastReadAt: now, unreadCount: 0 },
    });

    return { ok: true as const, chatId, lastReadAt: now.toISOString() };
  }

  // ---------------- WS helper: send message ----------------

  async sendMessage(userId: string, input: SendMessageInput) {
    await this.assertActiveUser(userId);

    const { chatId } = input;
    const text = (input.text ?? "").trim();
    const mediaIds = (input.mediaIds ?? []).filter(Boolean);

    if (!text && mediaIds.length === 0) {
      throw new BadRequestException({
        error: { code: "EMPTY_MESSAGE", message: "Message must have text or image" },
      });
    }

    const part = await this.requireParticipant(userId, chatId);
    const otherPart = part.chat.participants.find((p) => p.userId !== userId);
    const otherUser = otherPart?.user;
    if (!otherUser || otherUser.isBanned) throw new NotFoundException("Chat not found");

    await this.assertNotBlocked(userId, otherUser.id);

    // Ensure media IDs belong to sender
    let validMedia: { id: string }[] = [];
    if (mediaIds.length) {
      validMedia = await this.prisma.media.findMany({
        where: { id: { in: mediaIds }, userId },
        select: { id: true },
      });
      if (validMedia.length !== mediaIds.length) {
        throw new ForbiddenException("Invalid mediaId(s)");
      }
    }

    const now = new Date();

    const msg = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          chatId,
          senderId: userId,
          kind: mediaIds.length ? "image" : "text",
          text: text || null,
          createdAt: now,
          attachments: validMedia.length
            ? {
                create: validMedia.map((m) => ({
                  mediaId: m.id,
                })),
              }
            : undefined,
        },
        include: {
          attachments: {
            include: { media: { select: { id: true, url: true, contentType: true } } },
          },
        },
      });

      // bump unread count for other participant
      if (otherPart) {
        await tx.chatParticipant.update({
          where: { chatId_userId: { chatId, userId: otherPart.userId } },
          data: { unreadCount: { increment: 1 } },
        });
      }

      // update chat participant updatedAt (for ordering chat list)
      await tx.chatParticipant.updateMany({
        where: { chatId, userId: { in: [userId, otherPart?.userId].filter(Boolean) as string[] } },
        data: { updatedAt: now },
      });

      return created;
    });

    return {
      id: msg.id,
      chatId,
      senderId: userId,
      kind: msg.kind,
      text: msg.text,
      createdAt: now.toISOString(),
      attachments: (msg.attachments ?? []).map((a) => ({
        id: a.id,
        mediaId: a.mediaId,
        url: a.media?.url ?? null,
        contentType: a.media?.contentType ?? null,
      })),
      // for client convenience:
      otherUserId: otherUser.id,
    };
  }
}