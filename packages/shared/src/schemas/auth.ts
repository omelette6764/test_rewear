import { z } from "zod";
import { ZId, ZIsoDateTime } from "./common";

export const ZAuthSignupInput = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(60).optional(),
});

export const ZAuthLoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const ZAuthRefreshInput = z.object({
  refreshToken: z.string().min(1),
});

export const ZAuthLogoutInput = z.object({
  refreshToken: z.string().min(1),
});

export const ZAuthTokens = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: ZIsoDateTime,
  userId: ZId,
});

export type AuthSignupInput = z.infer<typeof ZAuthSignupInput>;
export type AuthLoginInput = z.infer<typeof ZAuthLoginInput>;
export type AuthRefreshInput = z.infer<typeof ZAuthRefreshInput>;
export type AuthLogoutInput = z.infer<typeof ZAuthLogoutInput>;
export type AuthTokens = z.infer<typeof ZAuthTokens>;