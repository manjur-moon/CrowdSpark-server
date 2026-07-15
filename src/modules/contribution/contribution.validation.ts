import { z } from "zod";

export const contributionIdParamsSchema = z.object({
  contributionId: z.string().trim().min(1)
});

export const contributionListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  status: z.enum(["pending", "approved", "rejected", "refund_requested", "refunded"]).optional(),
  search: z.string().trim().max(160).optional(),
  sort: z.enum(["newest", "oldest", "credits_high", "credits_low"]).optional()
});

export const createContributionSchema = z.object({
  campaignId: z.string().trim().min(1),
  credits: z.number().int().positive(),
  message: z.string().trim().max(1000).optional()
});

export const refundRequestSchema = z.object({
  reason: z.string().trim().min(10).max(500)
});

export type CreateContributionInput = z.infer<typeof createContributionSchema>;
export type RefundRequestInput = z.infer<typeof refundRequestSchema>;
