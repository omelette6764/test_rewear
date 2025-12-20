import { z } from "zod";
import { ZId, ZIsoDateTime } from "./common";
import { ZUserPublic } from "./users";

export const ZBlockUserInput = z.object({
  userId: ZId,
});

export const ZBlock = z.object({
  blockerId: ZId,
  blockedId: ZId,
  createdAt: ZIsoDateTime,
});

export const ZMyBlocksResponse = z.object({
  items: z.array(
    z.object({
      user: ZUserPublic,
      blockedAt: ZIsoDateTime,
    }),
  ),
});

export type BlockUserInput = z.infer<typeof ZBlockUserInput>;
export type Block = z.infer<typeof ZBlock>;
export type MyBlocksResponse = z.infer<typeof ZMyBlocksResponse>;