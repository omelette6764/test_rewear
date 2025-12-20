import { z } from "zod";
import { ZId, ZIsoDateTime } from "./common";

export const ZAddress = z.object({
  id: ZId,
  userId: ZId,
  name: z.string().min(1).max(80),
  line1: z.string().min(1).max(120),
  line2: z.string().max(120).nullable(),
  city: z.string().min(1).max(80),
  state: z.string().min(1).max(80),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(2).max(2), // ISO 3166-1 alpha-2
  phone: z.string().max(30).nullable(),
  isDefault: z.boolean(),
  createdAt: ZIsoDateTime,
  updatedAt: ZIsoDateTime,
});

export const ZCreateAddressInput = z.object({
  name: z.string().min(1).max(80),
  line1: z.string().min(1).max(120),
  line2: z.string().max(120).nullable().optional(),
  city: z.string().min(1).max(80),
  state: z.string().min(1).max(80),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(2).max(2),
  phone: z.string().max(30).nullable().optional(),
  makeDefault: z.boolean().optional(),
});

export const ZUpdateAddressInput = ZCreateAddressInput.partial();

export type Address = z.infer<typeof ZAddress>;
export type CreateAddressInput = z.infer<typeof ZCreateAddressInput>;
export type UpdateAddressInput = z.infer<typeof ZUpdateAddressInput>;