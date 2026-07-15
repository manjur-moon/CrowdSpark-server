import type { Response } from "express";
import type { AuthenticatedRequest } from "../../types.js";
import { AppError } from "../../utils/AppError.js";
import { completeOnboarding, getCurrentUser, listWalletTransactions } from "./user.service.js";

export async function me(req: AuthenticatedRequest, res: Response) {
  if (!req.sessionUser) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Please sign in");
  res.json({ success: true, data: await getCurrentUser(req.sessionUser) });
}

export async function onboarding(req: AuthenticatedRequest, res: Response) {
  if (!req.sessionUser) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Please sign in");
  const result = await completeOnboarding(req.sessionUser, req.body.role);
  res.status(result.created ? 201 : 200).json({
    success: true,
    message: result.created ? "Onboarding completed" : "Onboarding already completed",
    data: { ...result.profile.toObject(), id: result.profile._id.toString() }
  });
}

export async function walletTransactions(req: AuthenticatedRequest, res: Response) {
  const result = await listWalletTransactions(
    req.authContext!.profile._id,
    req.query as Record<string, unknown>
  );
  res.json({ success: true, ...result });
}
