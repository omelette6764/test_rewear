import { z } from "zod";
import { ZCursor, ZId, ZIsoDateTime } from "./common";

export const ZNotificationType = z.enum([
  "order_paid",
  "order_shipped",
  "order_completed",
  "message_new",
  "payout_released",
  "refund_created",
  "dispute_opened",
  "moderation_action",
]);

export const ZNotification = z.object({
  id: ZId,
  type: ZNotificationType,
  title: z.string(),
  body: z.string(),
  isRead: z.boolean(),
  createdAt: ZIsoDateTime,
  // optional deep link payload
  data: z.record(z.unknown()).optional(),
});

export const ZNotificationsQuery = z.object({
  cursor: ZCursor,
  limit: z.number().int().min(1).max(50).optional(),
});

export const ZNotificationsResponse = z.object({
  items: z.array(ZNotification),
  nextCursor: ZCursor,
});

export const ZBadgeResponse = z.object({
  unreadCount: z.number().int().nonnegative(),
});

export type NotificationType = z.infer<typeof ZNotificationType>;
export type Notification = z.infer<typeof ZNotification>;
export type NotificationsQuery = z.infer<typeof ZNotificationsQuery>;
export type NotificationsResponse = z.infer<typeof ZNotificationsResponse>;
export type BadgeResponse = z.infer<typeof ZBadgeResponse>;