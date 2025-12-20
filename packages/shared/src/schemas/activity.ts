import { z } from "zod";
import { ZCursor, ZId, ZIsoDateTime } from "./common";
import { ZListingCard } from "./listings";

export const ZActivitySummary = z.object({
  recentChatsCount: z.number().int().nonnegative(),
  recentLikesCount: z.number().int().nonnegative(),
  recentOrdersCount: z.number().int().nonnegative(),
});

export const ZActivityChatItem = z.object({
  chatId: ZId,
  otherUserId: ZId,
  otherDisplayName: z.string(),
  otherAvatarUrl: z.string().url().nullable(),
  lastMessagePreview: z.string().nullable(),
  lastMessageAt: ZIsoDateTime.nullable(),
  unreadCount: z.number().int().nonnegative(),
});

export const ZActivityOrderItem = z.object({
  orderId: ZId,
  listing: ZListingCard,
  status: z.string(), // status enum defined in orders.ts; keep lightweight here
  updatedAt: ZIsoDateTime,
});

export const ZMeActivityResponse = z.object({
  chats: z.object({
    items: z.array(ZActivityChatItem),
    nextCursor: ZCursor,
  }),
  likes: z.object({
    items: z.array(ZListingCard),
    nextCursor: ZCursor,
  }),
  orders: z.object({
    items: z.array(ZActivityOrderItem),
    nextCursor: ZCursor,
  }),
});

export type ActivitySummary = z.infer<typeof ZActivitySummary>;
export type ActivityChatItem = z.infer<typeof ZActivityChatItem>;
export type ActivityOrderItem = z.infer<typeof ZActivityOrderItem>;
export type MeActivityResponse = z.infer<typeof ZMeActivityResponse>;