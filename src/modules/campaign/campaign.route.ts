import { Router } from "express";
import { allowRoles, requireAuth, requireSession } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./campaign.controller.js";
import {
  campaignIdParamsSchema,
  campaignInputSchema,
  campaignListQuerySchema,
  updateCampaignSchema
} from "./campaign.validation.js";

export const campaignRouter = Router();

campaignRouter.get(
  "/mine",
  requireSession,
  requireAuth,
  allowRoles("creator", "admin"),
  validateRequest({ query: campaignListQuerySchema }),
  asyncHandler(controller.listMine)
);

campaignRouter.post(
  "/",
  requireSession,
  requireAuth,
  allowRoles("creator", "admin"),
  validateRequest({ body: campaignInputSchema }),
  asyncHandler(controller.create)
);

campaignRouter.patch(
  "/:campaignId",
  requireSession,
  requireAuth,
  allowRoles("creator", "admin"),
  validateRequest({ params: campaignIdParamsSchema, body: updateCampaignSchema }),
  asyncHandler(controller.update)
);

campaignRouter.delete(
  "/:campaignId",
  requireSession,
  requireAuth,
  allowRoles("creator"),
  validateRequest({ params: campaignIdParamsSchema }),
  asyncHandler(controller.remove)
);
