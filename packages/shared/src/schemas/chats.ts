import { z } from "zod";
import { ZCursor, ZId, ZIsoDateTime } from "./common";
import { ZMedia } from "./uploads";
import { ZUserPublic } from "./users";

export const ZMessageType = z.enum(["text", "image"]);

export const ZMessage = z.object({
  id: ZId,
  chatId: ZId,
  senderId: ZId,
  type: ZMessageType,
  text: z.string().nullable(),
  media: z.array(ZMedia).optional(), // for image messages
  createdAt: ZIsoDateTime,
});

export const ZChatListItem = z.object({
  id: ZId,
  otherUser: ZUserPublic,
  lastMessagePreview: z.string().nullable(),
  lastMessageAt: ZIsoDateTime.nullable(),
  unreadCount: z.number().int().nonnegative(),
});

export const ZChatThread = z.object({
  chatId: ZId,
  otherUser: ZUserPublic,
  otherLastReadAt: ZIsoDateTime.nullable(),
  messages: z.array(ZMessage),
  nextCursor: ZCursor,
});

export const ZCreateOrFindChatInput = z.object({
  otherUserId: ZId,
  listingId: ZId.optional(), // optional association
});

export const ZSendMessageInput = z.object({
  type: ZMessageType,
  text: z.string().max(5000).optional(),
  mediaIds: z.array(ZId).optional(), // for images
});

export const ZMarkReadResponse = z.object({
  chatId: ZId,
  unreadCount: z.number().int().nonnegative(),
  lastReadAt: ZIsoDateTime,
});

export const ZPresenceResponse = z.object({
  userId: ZId,
  status: z.enum(["online", "offline"]), // MVP
  updatedAt: ZIsoDateTime,
});

export type MessageType = z.infer<typeof ZMessageType>;
export type Message = z.infer<typeof ZMessage>;
export type ChatListItem = z.infer<typeof ZChatListItem>;
export type ChatThread = z.infer<typeof ZChatThread>;
export type CreateOrFindChatInput = z.infer<typeof ZCreateOrFindChatInput>;
export type SendMessageInput = z.infer<typeof ZSendMessageInput>;
export type MarkReadResponse = z.infer<typeof ZMarkReadResponse>;
export type PresenceResponse = z.infer<typeof ZPresenceResponse>;