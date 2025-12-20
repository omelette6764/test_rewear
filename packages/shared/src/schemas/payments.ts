import { z } from "zod";
import { ZId } from "./common";

export const ZCreatePaymentIntentInput = z.object({
  orderId: ZId,
  idempotencyKey: z.string().min(8).max(120),
});

export const ZCreatePaymentIntentResponse = z.object({
  orderId: ZId,
  paymentIntentClientSecret: z.string().min(1),
});

export type CreatePaymentIntentInput = z.infer<typeof ZCreatePaymentIntentInput>;
export type CreatePaymentIntentResponse = z.infer<typeof ZCreatePaymentIntentResponse>;