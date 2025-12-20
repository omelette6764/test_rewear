import { z } from "zod";
import { ZId } from "./common";

export const ZReportTargetType = z.enum(["user", "listing", "message"]);

export const ZCreateReportInput = z.object({
  targetType: ZReportTargetType,
  targetId: ZId,
  reason: z.string().min(1).max(500),
  details: z.string().max(2000).optional(),
});

export const ZCreateReportResponse = z.object({
  reportId: ZId,
});

export type ReportTargetType = z.infer<typeof ZReportTargetType>;
export type CreateReportInput = z.infer<typeof ZCreateReportInput>;
export type CreateReportResponse = z.infer<typeof ZCreateReportResponse>;