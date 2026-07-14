import type { Response } from "express";
import type { AuthenticatedRequest } from "../../types.js";
import { AppError } from "../../utils/AppError.js";
import { serializeWithdrawal } from "../financial/financial.service.js";
import {
  deleteCampaignSecure,
  removeUserSecure,
  reviewCampaignSecure,
  reviewReportSecure,
  reviewWithdrawalSecure,
  updateUserRoleSecure,
  updateUserStatusSecure
} from "./admin.service.js";
import {
  getAdminDashboard,
  getAdminFinancialSummary,
  listAdminAuditLogs,
  listAdminCampaigns,
  listAdminLedger,
  listAdminPayments,
  listAdminReports,
  listAdminUsers,
  listAdminWithdrawals
} from "./admin.query.service.js";

function getIdempotencyKey(req: AuthenticatedRequest): string {
  const key = String(req.headers["idempotency-key"] ?? "").trim();
  if (!key) {
    throw new AppError(428, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required");
  }
  if (key.length > 200) {
    throw new AppError(422, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key is too long");
  }
  return key;
}

function getAdminActor(req: AuthenticatedRequest) {
  const context = req.authContext!;
  return {
    profileId: context.profile._id,
    authUserId: context.user.id,
    name: context.profile.name,
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null
  };
}

function serializeDocument<
  T extends { toObject(): Record<string, unknown>; _id: { toString(): string } }
>(document: T, idempotentRetry: boolean) {
  return { ...document.toObject(), id: document._id.toString(), idempotentRetry };
}

export async function dashboard(_req: AuthenticatedRequest, res: Response) {
  res.json({ success: true, data: await getAdminDashboard() });
}

export async function users(req: AuthenticatedRequest, res: Response) {
  const result = await listAdminUsers(req.query as Record<string, unknown>);
  res.json({ success: true, ...result });
}

export async function updateUserRole(req: AuthenticatedRequest, res: Response) {
  const result = await updateUserRoleSecure({
    actor: getAdminActor(req),
    idempotencyKey: getIdempotencyKey(req),
    targetProfileId: String(req.params.userId),
    role: req.body.role
  });
  if (!result.user) throw new AppError(404, "USER_NOT_FOUND", "User not found after retry");
  res.json({
    success: true,
    message: result.idempotentRetry
      ? "User role was already updated"
      : "User role updated and sessions revoked",
    data: serializeDocument(result.user, result.idempotentRetry)
  });
}

export async function updateUserStatus(req: AuthenticatedRequest, res: Response) {
  const result = await updateUserStatusSecure({
    actor: getAdminActor(req),
    idempotencyKey: getIdempotencyKey(req),
    targetProfileId: String(req.params.userId),
    status: req.body.status,
    reason: req.body.reason
  });
  if (!result.user) throw new AppError(404, "USER_NOT_FOUND", "User not found after retry");
  res.json({
    success: true,
    message: result.idempotentRetry
      ? "User status was already updated"
      : "User status updated and sessions revoked",
    data: serializeDocument(result.user, result.idempotentRetry)
  });
}

export async function removeUser(req: AuthenticatedRequest, res: Response) {
  const result = await removeUserSecure({
    actor: getAdminActor(req),
    idempotencyKey: getIdempotencyKey(req),
    targetProfileId: String(req.params.userId),
    reason: req.body.reason
  });
  res.json({
    success: true,
    message: result.idempotentRetry ? "User was already removed" : "User removed securely",
    data: result
  });
}

export async function campaigns(req: AuthenticatedRequest, res: Response) {
  const result = await listAdminCampaigns(req.query as Record<string, unknown>);
  res.json({ success: true, ...result });
}

async function handleCampaignReview(
  req: AuthenticatedRequest,
  res: Response,
  action: "approve" | "reject" | "suspend"
) {
  const result = await reviewCampaignSecure({
    actor: getAdminActor(req),
    idempotencyKey: getIdempotencyKey(req),
    campaignId: String(req.params.campaignId),
    action,
    reason: req.body.reason
  });
  if (!result.campaign) {
    throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found after retry");
  }
  res.json({
    success: true,
    message: result.idempotentRetry
      ? `Campaign was already ${action === "approve" ? "approved" : `${action}ed`}`
      : `Campaign ${action === "approve" ? "approved" : `${action}ed`}`,
    data: serializeDocument(result.campaign, result.idempotentRetry)
  });
}

export function approveCampaign(req: AuthenticatedRequest, res: Response) {
  return handleCampaignReview(req, res, "approve");
}

export function rejectCampaign(req: AuthenticatedRequest, res: Response) {
  return handleCampaignReview(req, res, "reject");
}

export function suspendCampaign(req: AuthenticatedRequest, res: Response) {
  return handleCampaignReview(req, res, "suspend");
}

export async function deleteCampaign(req: AuthenticatedRequest, res: Response) {
  const result = await deleteCampaignSecure({
    actor: getAdminActor(req),
    idempotencyKey: getIdempotencyKey(req),
    campaignId: String(req.params.campaignId),
    reason: req.body.reason
  });
  res.json({
    success: true,
    message: result.idempotentRetry
      ? "Campaign action was already completed"
      : "Campaign deleted or archived with refunds",
    data: result
  });
}

export async function reports(req: AuthenticatedRequest, res: Response) {
  const result = await listAdminReports(req.query as Record<string, unknown>);
  res.json({ success: true, ...result });
}

async function handleReportReview(
  req: AuthenticatedRequest,
  res: Response,
  action: "resolve" | "dismiss" | "suspend_campaign" | "delete_campaign"
) {
  const result = await reviewReportSecure({
    actor: getAdminActor(req),
    idempotencyKey: getIdempotencyKey(req),
    reportId: String(req.params.reportId),
    action,
    resolutionNote: req.body.resolutionNote
  });
  if (!result.report) throw new AppError(404, "REPORT_NOT_FOUND", "Report not found after retry");
  res.json({
    success: true,
    message: result.idempotentRetry
      ? "Report action was already completed"
      : `Report action ${action} completed`,
    data: serializeDocument(result.report, result.idempotentRetry)
  });
}

export function resolveReport(req: AuthenticatedRequest, res: Response) {
  return handleReportReview(req, res, "resolve");
}

export function dismissReport(req: AuthenticatedRequest, res: Response) {
  return handleReportReview(req, res, "dismiss");
}

export function reportAction(req: AuthenticatedRequest, res: Response) {
  return handleReportReview(req, res, req.body.action);
}

export async function auditLogs(req: AuthenticatedRequest, res: Response) {
  const result = await listAdminAuditLogs(req.query as Record<string, unknown>);
  res.json({ success: true, ...result });
}

export async function withdrawals(req: AuthenticatedRequest, res: Response) {
  const result = await listAdminWithdrawals(req.query as Record<string, unknown>);
  res.json({ success: true, ...result });
}

export async function approveWithdrawal(req: AuthenticatedRequest, res: Response) {
  const result = await reviewWithdrawalSecure({
    actor: getAdminActor(req),
    idempotencyKey: getIdempotencyKey(req),
    withdrawalId: String(req.params.withdrawalId),
    action: "approve",
    settlementReference: req.body.settlementReference,
    reviewNote: req.body.reviewNote
  });
  if (!result.withdrawal) {
    throw new AppError(404, "WITHDRAWAL_NOT_FOUND", "Withdrawal not found after retry");
  }
  res.json({
    success: true,
    message: result.idempotentRetry ? "Withdrawal already approved" : "Withdrawal approved",
    data: {
      withdrawal: serializeWithdrawal(result.withdrawal),
      idempotentRetry: result.idempotentRetry
    }
  });
}

export async function rejectWithdrawal(req: AuthenticatedRequest, res: Response) {
  const result = await reviewWithdrawalSecure({
    actor: getAdminActor(req),
    idempotencyKey: getIdempotencyKey(req),
    withdrawalId: String(req.params.withdrawalId),
    action: "reject",
    reviewNote: req.body.reviewNote
  });
  if (!result.withdrawal) {
    throw new AppError(404, "WITHDRAWAL_NOT_FOUND", "Withdrawal not found after retry");
  }
  res.json({
    success: true,
    message: result.idempotentRetry ? "Withdrawal already rejected" : "Withdrawal rejected",
    data: {
      withdrawal: serializeWithdrawal(result.withdrawal),
      idempotentRetry: result.idempotentRetry
    }
  });
}

export async function financeSummary(_req: AuthenticatedRequest, res: Response) {
  res.json({ success: true, data: await getAdminFinancialSummary() });
}

export async function payments(req: AuthenticatedRequest, res: Response) {
  const result = await listAdminPayments(req.query as Record<string, unknown>);
  res.json({ success: true, ...result });
}

export async function ledger(req: AuthenticatedRequest, res: Response) {
  const result = await listAdminLedger(req.query as Record<string, unknown>);
  res.json({ success: true, ...result });
}
