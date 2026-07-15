import { Router } from "express";
import { requireAuth, requireSession } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./user.controller.js";
import { onboardingSchema, walletTransactionQuerySchema } from "./user.validation.js";

export const userRouter = Router();
userRouter.get("/me", requireSession, asyncHandler(controller.me));
userRouter.post(
  "/onboarding",
  requireSession,
  validateRequest({ body: onboardingSchema }),
  asyncHandler(controller.onboarding)
);
userRouter.get(
  "/wallet/transactions",
  requireSession,
  requireAuth,
  validateRequest({ query: walletTransactionQuerySchema }),
  asyncHandler(controller.walletTransactions)
);
