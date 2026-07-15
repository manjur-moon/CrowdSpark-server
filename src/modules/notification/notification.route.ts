import { Router } from "express";
import { requireAuth, requireSession } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./notification.controller.js";
import {
  notificationIdParamsSchema,
  notificationListQuerySchema
} from "./notification.validation.js";

export const notificationRouter = Router();
notificationRouter.use(requireSession, requireAuth);
notificationRouter.get("/unread-count", asyncHandler(controller.unreadCount));
notificationRouter.get(
  "/",
  validateRequest({ query: notificationListQuerySchema }),
  asyncHandler(controller.list)
);
notificationRouter.patch("/read-all", asyncHandler(controller.readAll));
notificationRouter.patch(
  "/:notificationId/read",
  validateRequest({ params: notificationIdParamsSchema }),
  asyncHandler(controller.readOne)
);
