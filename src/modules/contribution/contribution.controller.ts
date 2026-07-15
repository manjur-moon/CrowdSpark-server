import type { Response } from "express";
import type { AuthenticatedRequest } from "../../types.js";
import { AppError } from "../../utils/AppError.js";
import {
  getSupporterContribution,
  getSupporterDashboard,
  listSupporterContributions,
  requestContributionRefund,
  submitContribution
} from "./contribution.service.js";

function getIdempotencyKey(req: AuthenticatedRequest): string {
  const key = String(req.headers["idempotency-key"] ?? "").trim();
  if (!key) {
    throw new AppError(428, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required");
  }
  return key;
}

export async function dashboard(req: AuthenticatedRequest, res: Response) {
  const profile = req.authContext!.profile;
  const data = await getSupporterDashboard(profile._id, profile.credits);
  res.json({ success: true, data });
}

export async function create(req: AuthenticatedRequest, res: Response) {
  const result = await submitContribution(
    req.authContext!.profile._id,
    req.body,
    getIdempotencyKey(req)
  );

  res.status(result.idempotentRetry ? 200 : 201).json({
    success: true,
    message: result.idempotentRetry ? "Contribution already processed" : "Contribution submitted",
    data: {
      ...result.contribution.toObject(),
      id: result.contribution._id.toString(),
      idempotentRetry: result.idempotentRetry
    }
  });
}

export async function listMine(req: AuthenticatedRequest, res: Response) {
  const result = await listSupporterContributions(
    req.authContext!.profile._id,
    req.query as Record<string, unknown>
  );
  res.json({ success: true, ...result });
}

export async function getMine(req: AuthenticatedRequest, res: Response) {
  const data = await getSupporterContribution(
    String(req.params.contributionId),
    req.authContext!.profile._id
  );
  res.json({ success: true, data });
}

export async function requestRefund(req: AuthenticatedRequest, res: Response) {
  const contribution = await requestContributionRefund(
    String(req.params.contributionId),
    req.authContext!.profile._id,
    req.body
  );

  res.status(201).json({
    success: true,
    message: "Refund request submitted",
    data: {
      contribution: { ...contribution.toObject(), id: contribution._id.toString() },
      idempotentRetry: false
    }
  });
}
