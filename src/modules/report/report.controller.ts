import type { Response } from "express";
import type { AuthenticatedRequest } from "../../types.js";
import { createCampaignReport } from "./report.service.js";

export async function create(req: AuthenticatedRequest, res: Response) {
  const profile = req.authContext!.profile;
  const report = await createCampaignReport(
    { id: profile._id, name: profile.name, email: profile.email },
    req.body
  );
  res.status(201).json({
    success: true,
    message: "Campaign reported",
    data: { ...report.toObject(), id: report._id.toString() }
  });
}
