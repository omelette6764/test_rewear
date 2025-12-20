import { z } from "zod";
import { ZId, ZIsoDateTime } from "./common";

export const ZStartCheckoutInput = z.object({
  listingId: ZId,
  addressId: ZId,
  idempotencyKey: z.string().min(8).max(120),
});

export const ZStartCheckoutResponse = z.object({
  orderId: ZId,
  status: z.string(), // order status
  // Stripe PaymentSheet params (server returns what mobile needs)
  paymentIntentClientSecret: z.string().min(1),
  customerId: z.string().min(1),
  ephemeralKeySecret: z.string().min(1),
  publishableKey: z.string().min(1),
  expiresAt: ZIsoDateTime.nullable().optional(),
});

export const ZCheckoutStatusResponse = z.object({
  orderId: ZId,
  status: z.string(),
  updatedAt: ZIsoDateTime,
});

export const ZRetryCheckoutInput = z.object({
  idempotencyKey: z.string().min(8).max(120),
});

export const ZCancelCheckoutInput = z.object({
  idempotencyKey: z.string().min(8).max(120),
  reason: z.string().min(1).max(200).optional(),
});

export type StartCheckoutInput = z.infer<typeof ZStartCheckoutInput>;
export type StartCheckoutResponse = z.infer<typeof ZStartCheckoutResponse>;
export type CheckoutStatusResponse = z.infer<typeof ZCheckoutStatusResponse>;
export type RetryCheckoutInput = z.infer<typeof ZRetryCheckoutInput>;
export type CancelCheckoutInput = z.infer<typeof ZCancelCheckoutInput>;