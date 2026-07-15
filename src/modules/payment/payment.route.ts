import type { RequestHandler } from "express";
import { Router } from "express";
import { allowRoles, requireAuth, requireSession } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./payment.controller.js";
import { creditPackageSchema, paymentListQuerySchema } from "./payment.validation.js";

export const stripeWebhookHandler: RequestHandler = controller.webhook;
export const paymentRouter = Router();

paymentRouter.get("/packages", controller.packages);
paymentRouter.use(requireSession, requireAuth, allowRoles("supporter"));
paymentRouter.get(
  "/mine",
  validateRequest({ query: paymentListQuerySchema }),
  asyncHandler(controller.mine)
);
paymentRouter.post(
  "/demo",
  validateRequest({ body: creditPackageSchema }),
  asyncHandler(controller.demo)
);
paymentRouter.post(
  "/checkout",
  validateRequest({ body: creditPackageSchema }),
  asyncHandler(controller.checkout)
);
