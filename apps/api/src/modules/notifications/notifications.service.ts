import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export type NotificationType =
  | "order_shipped"
  | "order_delivered"
  | "review_received"
  | "payout_released"
  | "system";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async emit(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
  }) {
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        dataJson: input.data ? JSON.stringify(input.data) : null,
      },
    });

    return { ok: true as const };
  }

  async badge(userId: string) {
    const unread = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { unreadCount: unread };
  }

  async list(userId: string, opts: { cursor: string | null; limit: number }) {
    // Cursor = notification id (stable). Order by createdAt desc then id desc.
    const where: any = { userId };
    const take = opts.limit;

    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      ...(opts.cursor
        ? { skip: 1, cursor: { id: opts.cursor } }
        : {}),
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        dataJson: true,
        readAt: true,
        createdAt: true,
      },
    });

    const nextCursor = rows.length === take ? rows[rows.length - 1].id : null;

    return {
      items: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.dataJson ? safeJson(n.dataJson) : null,
        readAt: n.readAt?.toISOString?.() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async markRead(userId: string, notificationId: string) {
    const n = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true, userId: true, readAt: true },
    });
    if (!n) throw new NotFoundException("Notification not found");
    if (n.userId !== userId) throw new ForbiddenException("Not your notification");

    if (n.readAt) return { ok: true as const, id: n.id, readAt: n.readAt.toISOString() };

    const updated = await this.prisma.notification.update({
      where: { id: n.id },
      data: { readAt: new Date() },
      select: { id: true, readAt: true },
    });

    return { ok: true as const, id: updated.id, readAt: updated.readAt?.toISOString?.() ?? null };
  }
}

function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
