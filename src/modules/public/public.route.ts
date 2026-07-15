import { Router } from "express";
import { validateRequest } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./public.controller.js";
import {
  contactMessageSchema,
  publicCampaignListQuerySchema,
  publicCampaignParamsSchema
} from "./public.validation.js";

export const publicRouter = Router();
publicRouter.get("/health", controller.health);
publicRouter.get("/stats", asyncHandler(controller.stats));
publicRouter.get("/campaigns/categories", asyncHandler(controller.categories));
publicRouter.get(
  "/campaigns",
  validateRequest({ query: publicCampaignListQuerySchema }),
  asyncHandler(controller.campaigns)
);
publicRouter.get(
  "/campaigns/:campaignId",
  validateRequest({ params: publicCampaignParamsSchema }),
  asyncHandler(controller.campaign)
);
publicRouter.get(
  "/campaigns/:campaignId/updates",
  validateRequest({ params: publicCampaignParamsSchema }),
  asyncHandler(controller.updates)
);
publicRouter.post(
  "/contact",
  validateRequest({ body: contactMessageSchema }),
  asyncHandler(controller.contact)
);
