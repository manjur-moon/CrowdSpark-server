import { z } from "zod";

export const paymentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional()
});

export const creditPackageSchema = z.object({
  credits: z.number().int().positive()
});
