import { z } from "zod";

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  status: z.enum(["read", "unread"]).optional(),
  type: z.string().trim().max(80).optional(),
  sort: z.enum(["newest", "oldest"]).optional()
});

export const notificationIdParamsSchema = z.object({
  notificationId: z.string().trim().min(1)
});
