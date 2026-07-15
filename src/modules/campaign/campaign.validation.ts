import { z } from "zod";

export const campaignIdParamsSchema = z.object({
  campaignId: z.string().trim().min(1)
});

export const campaignListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  status: z
    .enum(["draft", "pending", "approved", "rejected", "suspended", "completed", "archived"])
    .optional()
});

export const campaignInputSchema = z.object({
  title: z.string().trim().min(5).max(160),
  story: z.string().trim().min(30).max(10_000),
  description: z.string().trim().min(10).max(500),
  category: z.string().trim().min(2).max(80),
  goalCredits: z.number().int().min(100),
  minimumContribution: z.number().int().min(1),
  deadline: z.coerce.date(),
  rewardInfo: z.string().trim().max(1_000).default(""),
  coverImageUrl: z.string().url(),
  gallery: z.array(z.string().url()).max(6).default([]),
  location: z.string().trim().max(120).default("Global")
});

export const updateCampaignSchema = campaignInputSchema.partial();

export type CampaignInput = z.infer<typeof campaignInputSchema>;
export type CampaignUpdateInput = z.infer<typeof updateCampaignSchema>;
