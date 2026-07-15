import { z } from "zod";

export const publicCampaignListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    search: z.string().trim().max(160).optional(),
    category: z.string().trim().max(80).optional(),
    sort: z
      .enum(["newest", "oldest", "most_funded", "ending_soon", "goal_high", "goal_low"])
      .optional(),
    status: z.enum(["approved", "completed"]).optional(),
    deadline: z.enum(["7d", "30d", "60d", "90d"]).optional(),
    minGoal: z.coerce.number().min(0).optional(),
    maxGoal: z.coerce.number().min(0).optional()
  })
  .refine(
    (value) =>
      value.minGoal === undefined || value.maxGoal === undefined || value.minGoal <= value.maxGoal,
    { message: "minGoal cannot be greater than maxGoal", path: ["minGoal"] }
  );

export const publicCampaignParamsSchema = z.object({
  campaignId: z.string().trim().min(1)
});

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(320),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(2_000)
});
