import { z } from "zod";

export const onboardingSchema = z.object({
  role: z.enum(["supporter", "creator"])
});

export const walletTransactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional()
});
