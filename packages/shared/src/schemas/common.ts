import { z } from "zod";

/** Generic primitives */
export const ZId = z.string().min(1);
export const ZCents = z.number().int().nonnegative();
export const ZIsoDateTime = z.string().datetime();
export const ZCursor = z.string().min(1).optional();

/** Pagination */
export const ZPage = z.object({
  cursor: ZCursor,
  limit: z.number().int().min(1).max(100).optional(),
});

/** Standard API error (shape you can expand later) */
export const ZApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

/** Standard success envelope (optional pattern) */
export const ZOk = z.object({ ok: z.literal(true) });

/** Common enums */
export const ZSortOrder = z.enum(["asc", "desc"]);

export type Id = z.infer<typeof ZId>;
export type Cents = z.infer<typeof ZCents>;
export type IsoDateTime = z.infer<typeof ZIsoDateTime>;