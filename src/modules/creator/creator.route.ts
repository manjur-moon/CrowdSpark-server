import { Router } from "express";
import { allowRoles, requireAuth, requireSession } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./creator.controller.js";
import {
  campaignUpdateSchema,
  contributionRejectionSchema,
  creatorCampaignParamsSchema,
  creatorCampaignUpdateParamsSchema,
  creatorContributionListQuerySchema,
  creatorContributionParamsSchema,
  creatorWithdrawalListQuerySchema,
  creatorWithdrawalSchema
} from "./creator.validation.js";

export const creatorRouter = Router();
creatorRouter.use(requireSession, requireAuth, allowRoles("creator"));

creatorRouter.get("/dashboard", asyncHandler(controller.dashboard));
creatorRouter.get("/campaigns", asyncHandler(controller.campaigns));
creatorRouter.get(
  "/contributions",
  validateRequest({ query: creatorContributionListQuerySchema }),
  asyncHandler(controller.contributions)
);
creatorRouter.post(
  "/contributions/:contributionId/approve",
  validateRequest({ params: creatorContributionParamsSchema }),
  asyncHandler(controller.approveContribution)
);
creatorRouter.post(
  "/contributions/:contributionId/reject",
  validateRequest({ params: creatorContributionParamsSchema, body: contributionRejectionSchema }),
  asyncHandler(controller.rejectContribution)
);
creatorRouter.get(
  "/campaigns/:campaignId/updates",
  validateRequest({ params: creatorCampaignParamsSchema }),
  asyncHandler(controller.campaignUpdates)
);
creatorRouter.post(
  "/campaigns/:campaignId/updates",
  validateRequest({ params: creatorCampaignParamsSchema, body: campaignUpdateSchema }),
  asyncHandler(controller.createUpdate)
);
creatorRouter.patch(
  "/campaigns/:campaignId/updates/:updateId",
  validateRequest({ params: creatorCampaignUpdateParamsSchema, body: campaignUpdateSchema }),
  asyncHandler(controller.editUpdate)
);
creatorRouter.delete(
  "/campaigns/:campaignId/updates/:updateId",
  validateRequest({ params: creatorCampaignUpdateParamsSchema }),
  asyncHandler(controller.removeUpdate)
);
creatorRouter.get(
  "/withdrawals",
  validateRequest({ query: creatorWithdrawalListQuerySchema }),
  asyncHandler(controller.withdrawals)
);
creatorRouter.post(
  "/withdrawals",
  validateRequest({ body: creatorWithdrawalSchema }),
  asyncHandler(controller.requestWithdrawal)
);
