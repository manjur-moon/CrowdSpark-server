import { z } from "zod";

export const createReportSchema = z.object({
  campaignId: z.string().trim().min(1),
  reason: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1_000).optional()
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
