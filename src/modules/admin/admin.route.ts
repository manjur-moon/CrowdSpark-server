import { Router } from "express";
import { allowRoles, requireAuth, requireSession } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./admin.controller.js";
import {
  adminAuditListQuerySchema,
  adminCampaignListQuerySchema,
  adminCampaignParamsSchema,
  adminLedgerListQuerySchema,
  adminPaymentListQuerySchema,
  adminReportListQuerySchema,
  adminReportParamsSchema,
  adminUserListQuerySchema,
  adminUserParamsSchema,
  adminWithdrawalListQuerySchema,
  adminWithdrawalParamsSchema,
  approveWithdrawalSchema,
  reasonSchema,
  rejectWithdrawalSchema,
  reportActionSchema,
  reportReviewSchema,
  updateUserRoleSchema,
  updateUserStatusSchema
} from "./admin.validation.js";

export const adminRouter = Router();
adminRouter.use(requireSession, requireAuth, allowRoles("admin"));

adminRouter.get("/dashboard", asyncHandler(controller.dashboard));
adminRouter.get(
  "/users",
  validateRequest({ query: adminUserListQuerySchema }),
  asyncHandler(controller.users)
);
adminRouter.patch(
  "/users/:userId/role",
  validateRequest({ params: adminUserParamsSchema, body: updateUserRoleSchema }),
  asyncHandler(controller.updateUserRole)
);
adminRouter.patch(
  "/users/:userId/status",
  validateRequest({ params: adminUserParamsSchema, body: updateUserStatusSchema }),
  asyncHandler(controller.updateUserStatus)
);
adminRouter.delete(
  "/users/:userId",
  validateRequest({ params: adminUserParamsSchema, body: reasonSchema }),
  asyncHandler(controller.removeUser)
);

adminRouter.get(
  "/campaigns",
  validateRequest({ query: adminCampaignListQuerySchema }),
  asyncHandler(controller.campaigns)
);
adminRouter.post(
  "/campaigns/:campaignId/approve",
  validateRequest({ params: adminCampaignParamsSchema }),
  asyncHandler(controller.approveCampaign)
);
adminRouter.post(
  "/campaigns/:campaignId/reject",
  validateRequest({ params: adminCampaignParamsSchema, body: reasonSchema }),
  asyncHandler(controller.rejectCampaign)
);
adminRouter.post(
  "/campaigns/:campaignId/suspend",
  validateRequest({ params: adminCampaignParamsSchema, body: reasonSchema }),
  asyncHandler(controller.suspendCampaign)
);
adminRouter.delete(
  "/campaigns/:campaignId",
  validateRequest({ params: adminCampaignParamsSchema, body: reasonSchema }),
  asyncHandler(controller.deleteCampaign)
);

adminRouter.get(
  "/reports",
  validateRequest({ query: adminReportListQuerySchema }),
  asyncHandler(controller.reports)
);
adminRouter.post(
  "/reports/:reportId/resolve",
  validateRequest({ params: adminReportParamsSchema, body: reportReviewSchema }),
  asyncHandler(controller.resolveReport)
);
adminRouter.post(
  "/reports/:reportId/dismiss",
  validateRequest({ params: adminReportParamsSchema, body: reportReviewSchema }),
  asyncHandler(controller.dismissReport)
);
adminRouter.post(
  "/reports/:reportId/action",
  validateRequest({ params: adminReportParamsSchema, body: reportActionSchema }),
  asyncHandler(controller.reportAction)
);

adminRouter.get(
  "/audit-logs",
  validateRequest({ query: adminAuditListQuerySchema }),
  asyncHandler(controller.auditLogs)
);
adminRouter.get(
  "/withdrawals",
  validateRequest({ query: adminWithdrawalListQuerySchema }),
  asyncHandler(controller.withdrawals)
);
adminRouter.post(
  "/withdrawals/:withdrawalId/approve",
  validateRequest({ params: adminWithdrawalParamsSchema, body: approveWithdrawalSchema }),
  asyncHandler(controller.approveWithdrawal)
);
adminRouter.post(
  "/withdrawals/:withdrawalId/reject",
  validateRequest({ params: adminWithdrawalParamsSchema, body: rejectWithdrawalSchema }),
  asyncHandler(controller.rejectWithdrawal)
);

adminRouter.get("/finance/summary", asyncHandler(controller.financeSummary));
adminRouter.get(
  "/payments",
  validateRequest({ query: adminPaymentListQuerySchema }),
  asyncHandler(controller.payments)
);
adminRouter.get(
  "/ledger",
  validateRequest({ query: adminLedgerListQuerySchema }),
  asyncHandler(controller.ledger)
);
