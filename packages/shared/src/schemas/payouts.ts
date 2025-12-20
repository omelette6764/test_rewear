import { z } from "zod";
import { ZId, ZIsoDateTime } from "./common";

export const ZReleasePayoutInput = z.object({
  orderId: ZId,
});

export const ZReleasePayoutResponse = z.object({
  payoutId: ZId,
  status: z.enum(["held", "eligible", "paid", "reversed", "blocked"]),
  releasedAt: ZIsoDateTime.nullable().optional(),
});

export type ReleasePayoutInput = z.infer<typeof ZReleasePayoutInput>;
export type ReleasePayoutResponse = z.infer<typeof ZReleasePayoutResponse>;