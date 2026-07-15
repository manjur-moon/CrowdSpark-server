import type { Response } from "express";
import type { AuthenticatedRequest } from "../../types.js";
import { AppError } from "../../utils/AppError.js";
import {
  approveCreatorContribution,
  createCampaignUpdate,
  createCreatorWithdrawal,
  deleteCampaignUpdate,
  getCreatorDashboard,
  listCampaignUpdates,
  listCreatorCampaignOptions,
  listCreatorContributions,
  listCreatorWithdrawals,
  rejectCreatorContribution,
  updateCampaignUpdate
} from "./creator.service.js";
import { serializeWithdrawal } from "../financial/financial.service.js";

function getIdempotencyKey(req: AuthenticatedRequest): string {
  const key = String(req.headers["idempotency-key"] ?? "").trim();
  if (!key) {
    throw new AppError(428, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required");
  }
  return key;
}

export async function dashboard(req: AuthenticatedRequest, res: Response) {
  const data = await getCreatorDashboard(req.authContext!.profile);
  res.json({ success: true, data });
}

export async function campaigns(req: AuthenticatedRequest, res: Response) {
  const data = await listCreatorCampaignOptions(req.authContext!.profile._id);
  res.json({ success: true, data });
}

export async function contributions(req: AuthenticatedRequest, res: Response) {
  const result = await listCreatorContributions(
    req.authContext!.profile._id,
    req.query as Record<string, unknown>
  );
  res.json({ success: true, ...result });
}

export async function approveContribution(req: AuthenticatedRequest, res: Response) {
  getIdempotencyKey(req);
  const result = await approveCreatorContribution(
    req.authContext!.profile._id,
    String(req.params.contributionId)
  );
  res.json({
    success: true,
    message: result.idempotentRetry ? "Contribution already approved" : "Contribution approved",
    data: {
      contribution: { ...result.contribution.toObject(), id: result.contribution._id.toString() },
      idempotentRetry: result.idempotentRetry
    }
  });
}

export async function rejectContribution(req: AuthenticatedRequest, res: Response) {
  getIdempotencyKey(req);
  const result = await rejectCreatorContribution(
    req.authContext!.profile._id,
    String(req.params.contributionId),
    req.body.reviewNote
  );
  res.json({
    success: true,
    message: result.idempotentRetry
      ? "Contribution already rejected"
      : "Contribution rejected and credits returned",
    data: {
      contribution: { ...result.contribution.toObject(), id: result.contribution._id.toString() },
      idempotentRetry: result.idempotentRetry
    }
  });
}

export async function campaignUpdates(req: AuthenticatedRequest, res: Response) {
  const data = await listCampaignUpdates(
    String(req.params.campaignId),
    req.authContext!.profile._id
  );
  res.json({ success: true, data });
}

export async function createUpdate(req: AuthenticatedRequest, res: Response) {
  const update = await createCampaignUpdate(
    String(req.params.campaignId),
    req.authContext!.profile._id,
    req.body
  );
  res.status(201).json({
    success: true,
    message: "Campaign update published",
    data: { ...update.toObject(), id: update._id.toString() }
  });
}

export async function editUpdate(req: AuthenticatedRequest, res: Response) {
  const update = await updateCampaignUpdate(
    String(req.params.campaignId),
    String(req.params.updateId),
    req.authContext!.profile._id,
    req.body
  );
  res.json({
    success: true,
    message: "Campaign update edited",
    data: { ...update.toObject(), id: update._id.toString() }
  });
}

export async function removeUpdate(req: AuthenticatedRequest, res: Response) {
  await deleteCampaignUpdate(
    String(req.params.campaignId),
    String(req.params.updateId),
    req.authContext!.profile._id
  );
  res.json({ success: true, message: "Campaign update deleted" });
}

export async function withdrawals(req: AuthenticatedRequest, res: Response) {
  const result = await listCreatorWithdrawals(
    req.authContext!.profile._id,
    req.query as Record<string, unknown>
  );
  res.json({ success: true, ...result });
}

export async function requestWithdrawal(req: AuthenticatedRequest, res: Response) {
  const result = await createCreatorWithdrawal(
    req.authContext!.profile._id,
    req.body,
    getIdempotencyKey(req)
  );
  res.status(result.idempotentRetry ? 200 : 201).json({
    success: true,
    message: result.idempotentRetry ? "Withdrawal already requested" : "Withdrawal requested",
    data: { ...serializeWithdrawal(result.withdrawal), idempotentRetry: result.idempotentRetry }
  });
}
