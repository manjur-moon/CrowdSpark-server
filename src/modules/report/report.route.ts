import { Router } from "express";
import { allowRoles, requireAuth, requireSession } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { create } from "./report.controller.js";
import { createReportSchema } from "./report.validation.js";

export const reportRouter = Router();
reportRouter.use(requireSession, requireAuth, allowRoles("supporter", "creator"));
reportRouter.post("/", validateRequest({ body: createReportSchema }), asyncHandler(create));
