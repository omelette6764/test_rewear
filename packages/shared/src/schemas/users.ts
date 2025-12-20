import { z } from "zod";
import { ZId, ZIsoDateTime } from "./common";

export const ZUserPublic = z.object({
  id: ZId,
  displayName: z.string(),
  avatarUrl: z.string().url().nullable().optional(),
  ratingAvg: z.number().min(0).max(5).nullable().optional(),
  ratingCount: z.number().int().nonnegative().optional(),
});

export const ZMe = z.object({
  id: ZId,
  email: z.string().email(),
  displayName: z.string(),
  avatarUrl: z.string().url().nullable(),
  createdAt: ZIsoDateTime,
  // seller / payouts summary fields (populated when Stripe Connect is in play)
  stripeSellerStatus: z
    .object({
      hasAccount: z.boolean(),
      chargesEnabled: z.boolean().optional(),
      payoutsEnabled: z.boolean().optional(),
      detailsSubmitted: z.boolean().optional(),
    })
    .optional(),
});

export const ZUpdateMeInput = z.object({
  displayName: z.string().min(1).max(60).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export type UserPublic = z.infer<typeof ZUserPublic>;
export type Me = z.infer<typeof ZMe>;
export type UpdateMeInput = z.infer<typeof ZUpdateMeInput>;