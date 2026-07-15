import { Router } from "express";
import { allowRoles, requireAuth, requireSession } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./contribution.controller.js";
import {
  contributionIdParamsSchema,
  contributionListQuerySchema,
  createContributionSchema,
  refundRequestSchema
} from "./contribution.validation.js";

export const contributionRouter = Router();
contributionRouter.use(requireSession, requireAuth, allowRoles("supporter"));

contributionRouter.get("/dashboard", asyncHandler(controller.dashboard));
contributionRouter.post(
  "/",
  validateRequest({ body: createContributionSchema }),
  asyncHandler(controller.create)
);
contributionRouter.get(
  "/mine",
  validateRequest({ query: contributionListQuerySchema }),
  asyncHandler(controller.listMine)
);
contributionRouter.get(
  "/mine/:contributionId",
  validateRequest({ params: contributionIdParamsSchema }),
  asyncHandler(controller.getMine)
);
contributionRouter.post(
  "/:contributionId/refund-requests",
  validateRequest({ params: contributionIdParamsSchema, body: refundRequestSchema }),
  asyncHandler(controller.requestRefund)
);
