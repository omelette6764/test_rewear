import { z } from "zod";
import { ZListingCard } from "./listings";

export const ZHomeFeaturedResponse = z.object({
  items: z.array(ZListingCard),
});

export type HomeFeaturedResponse = z.infer<typeof ZHomeFeaturedResponse>;