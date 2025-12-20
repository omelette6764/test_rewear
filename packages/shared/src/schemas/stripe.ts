import { z } from "zod";
import { ZIsoDateTime } from "./common";

export const ZCreateConnectAccountResponse = z.object({
  accountId: z.string().min(1),
});

export const ZCreateOnboardingLinkResponse = z.object({
  url: z.string().url(),
  expiresAt: ZIsoDateTime.nullable().optional(),
});

export const ZConnectStatusResponse = z.object({
  hasAccount: z.boolean(),
  accountId: z.string().min(1).nullable(),
  chargesEnabled: z.boolean().optional(),
  payoutsEnabled: z.boolean().optional(),
  detailsSubmitted: z.boolean().optional(),
});

export type CreateConnectAccountResponse = z.infer<typeof ZCreateConnectAccountResponse>;
export type CreateOnboardingLinkResponse = z.infer<typeof ZCreateOnboardingLinkResponse>;
export type ConnectStatusResponse = z.infer<typeof ZConnectStatusResponse>;