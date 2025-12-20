import { z } from "zod";
import { ZId, ZIsoDateTime } from "./common";

export const ZUploadKind = z.enum(["listing_photo", "chat_image", "avatar"]);

export const ZCreateImageUploadInput = z.object({
  kind: ZUploadKind,
  contentType: z.string().min(1), // e.g. image/jpeg
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024), // 20MB default
});

export const ZCreateImageUploadResponse = z.object({
  mediaId: ZId,
  uploadUrl: z.string().url(),
  // optional headers required by provider; keep flexible
  uploadHeaders: z.record(z.string()).optional(),
  expiresAt: ZIsoDateTime,
});

export const ZCompleteUploadInput = z.object({
  mediaId: ZId,
});

export const ZMedia = z.object({
  id: ZId,
  kind: ZUploadKind,
  url: z.string().url(),
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  uploadedAt: ZIsoDateTime.nullable().optional(),
});

export type UploadKind = z.infer<typeof ZUploadKind>;
export type CreateImageUploadInput = z.infer<typeof ZCreateImageUploadInput>;
export type CreateImageUploadResponse = z.infer<typeof ZCreateImageUploadResponse>;
export type CompleteUploadInput = z.infer<typeof ZCompleteUploadInput>;
export type Media = z.infer<typeof ZMedia>;