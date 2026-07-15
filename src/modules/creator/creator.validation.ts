import { z } from "zod";

export const creatorContributionParamsSchema = z.object({
  contributionId: z.string().trim().min(1)
});

export const creatorCampaignParamsSchema = z.object({
  campaignId: z.string().trim().min(1)
});

export const creatorCampaignUpdateParamsSchema = z.object({
  campaignId: z.string().trim().min(1),
  updateId: z.string().trim().min(1)
});

export const creatorContributionListQuerySchema = z.object({
  campaignId: z.string().trim().optional(),
  status: z.enum(["pending", "approved", "rejected", "refund_requested", "refunded"]).optional(),
  search: z.string().trim().max(160).optional(),
  sort: z.enum(["newest", "oldest", "credits_high", "credits_low"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional()
});

export const contributionRejectionSchema = z.object({
  reviewNote: z.string().trim().min(10).max(500)
});

export const campaignUpdateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  content: z.string().trim().min(10).max(5000)
});

export const creatorWithdrawalListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional()
});

export const creatorWithdrawalSchema = z.object({
  credits: z.number().int().min(200),
  method: z.enum(["stripe", "bkash", "rocket", "nagad", "bank"]),
  accountReference: z.string().trim().min(4).max(120)
});

export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;
export type CreatorWithdrawalInput = z.infer<typeof creatorWithdrawalSchema>;
