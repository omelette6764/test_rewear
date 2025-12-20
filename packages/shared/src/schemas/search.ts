import { z } from "zod";
import { ZCursor } from "./common";
import { ZExploreListingsQuery, ZExploreListingsResponse } from "./listings";

/**
 * We treat "search" as the same shape as explore listings query/response.
 * Keeps mobile + backend aligned.
 */
export const ZSearchQuery = ZExploreListingsQuery;
export const ZSearchResponse = ZExploreListingsResponse;

export type SearchQuery = z.infer<typeof ZSearchQuery>;
export type SearchResponse = z.infer<typeof ZSearchResponse>;