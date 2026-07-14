import { z } from "zod";

export const adminUserParamsSchema = z.object({ userId: z.string().trim().min(1) });
export const adminCampaignParamsSchema = z.object({ campaignId: z.string().trim().min(1) });
export const adminReportParamsSchema = z.object({ reportId: z.string().trim().min(1) });
export const adminWithdrawalParamsSchema = z.object({ withdrawalId: z.string().trim().min(1) });

const paginationFields = {
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  search: z.string().trim().max(160).optional(),
  sort: z.enum(["newest", "oldest"]).optional()
};

export const adminUserListQuerySchema = z.object({
  ...paginationFields,
  role: z.enum(["supporter", "creator", "admin"]).optional(),
  status: z.enum(["active", "suspended", "banned"]).optional()
});

export const adminCampaignListQuerySchema = z.object({
  ...paginationFields,
  status: z
    .enum(["draft", "pending", "approved", "rejected", "suspended", "completed", "archived"])
    .optional()
});

export const adminReportListQuerySchema = z.object({
  ...paginationFields,
  status: z.enum(["pending", "resolved", "dismissed"]).optional()
});

export const adminWithdrawalListQuerySchema = z.object({
  ...paginationFields,
  status: z.enum(["pending", "approved", "rejected"]).optional()
});

export const adminPaymentListQuerySchema = z.object({
  ...paginationFields,
  status: z.enum(["pending", "succeeded", "failed", "refunded"]).optional()
});

export const adminLedgerListQuerySchema = z.object({
  ...paginationFields,
  type: z.string().trim().max(80).optional()
});

export const adminAuditListQuerySchema = z.object({
  page: paginationFields.page,
  limit: paginationFields.limit,
  action: z.string().trim().max(120).optional(),
  targetType: z.enum(["user", "campaign", "report", "withdrawal"]).optional()
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["supporter", "creator", "admin"])
});

export const updateUserStatusSchema = z.object({
  status: z.enum(["active", "suspended", "banned"]),
  reason: z.string().trim().max(500).optional()
});

export const reasonSchema = z.object({ reason: z.string().trim().min(10).max(500) });
export const reportReviewSchema = z.object({
  resolutionNote: z.string().trim().min(10).max(500)
});
export const reportActionSchema = reportReviewSchema.extend({
  action: z.enum(["resolve", "dismiss", "suspend_campaign", "delete_campaign"])
});
export const approveWithdrawalSchema = z.object({
  settlementReference: z.string().trim().min(3).max(200),
  reviewNote: z.string().trim().max(500).optional()
});
export const rejectWithdrawalSchema = z.object({
  reviewNote: z.string().trim().min(10).max(500)
});
