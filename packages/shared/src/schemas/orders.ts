import { z } from "zod";
import { ZCents, ZCursor, ZId, ZIsoDateTime } from "./common";
import { ZListingCard } from "./listings";

export const ZOrderStatus = z.enum([
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "completed",
  "canceled",
  "refunded",
  "disputed",
]);

export const ZOrderGroup = z.enum([
  "requires_payment",
  "processing",
  "shipped",
  "completed",
  "canceled",
  "refunded",
  "disputed",
]);

export const ZOrderSummary = z.object({
  id: ZId,
  listing: ZListingCard,
  status: ZOrderStatus,
  totalCents: ZCents,
  updatedAt: ZIsoDateTime,
});

export const ZMyOrdersQuery = z.object({
  group: ZOrderGroup.optional(),
  cursor: ZCursor,
  limit: z.number().int().min(1).max(50).optional(),
});

export const ZMyOrdersResponse = z.object({
  items: z.array(ZOrderSummary),
  nextCursor: ZCursor,
});

export const ZSalesOrdersQuery = ZMyOrdersQuery;
export const ZSalesOrdersResponse = ZMyOrdersResponse;

export const ZAttachShippingAddressInput = z.object({
  addressId: ZId,
});

export const ZAddTrackingInput = z.object({
  carrier: z.string().max(40).nullable().optional(),
  trackingNumber: z.string().min(3).max(80),
  trackingUrl: z.string().url().nullable().optional(),
});

export const ZConfirmDeliveryResponse = z.object({
  orderId: ZId,
  status: ZOrderStatus,
});

export const ZCancelOrderInput = z.object({
  reason: z.string().min(1).max(200),
});

export type OrderStatus = z.infer<typeof ZOrderStatus>;
export type OrderSummary = z.infer<typeof ZOrderSummary>;
export type MyOrdersQuery = z.infer<typeof ZMyOrdersQuery>;
export type MyOrdersResponse = z.infer<typeof ZMyOrdersResponse>;
export type SalesOrdersQuery = z.infer<typeof ZSalesOrdersQuery>;
export type SalesOrdersResponse = z.infer<typeof ZSalesOrdersResponse>;
export type AttachShippingAddressInput = z.infer<typeof ZAttachShippingAddressInput>;
export type AddTrackingInput = z.infer<typeof ZAddTrackingInput>;
export type ConfirmDeliveryResponse = z.infer<typeof ZConfirmDeliveryResponse>;
export type CancelOrderInput = z.infer<typeof ZCancelOrderInput>;