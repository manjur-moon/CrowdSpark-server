import type { Response } from "express";
import type { AuthenticatedRequest } from "../../types.js";
import {
  createCampaign,
  deleteCreatorCampaign,
  listCreatorCampaigns,
  updateCreatorCampaign
} from "./campaign.service.js";

export async function listMine(req: AuthenticatedRequest, res: Response) {
  const result = await listCreatorCampaigns(
    req.authContext!.profile._id,
    req.query as Record<string, unknown>
  );
  res.json({ success: true, ...result });
}

export async function create(req: AuthenticatedRequest, res: Response) {
  const profile = req.authContext!.profile;
  const campaign = await createCampaign(
    { id: profile._id, name: profile.name, email: profile.email },
    req.body
  );
  res.status(201).json({
    success: true,
    message: "Campaign submitted for review",
    data: { ...campaign.toObject(), id: campaign._id.toString() }
  });
}

export async function update(req: AuthenticatedRequest, res: Response) {
  const campaign = await updateCreatorCampaign(
    String(req.params.campaignId),
    req.authContext!.profile._id,
    req.body
  );
  res.json({
    success: true,
    message: "Campaign updated and resubmitted",
    data: { ...campaign.toObject(), id: campaign._id.toString() }
  });
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  const result = await deleteCreatorCampaign(
    String(req.params.campaignId),
    req.authContext!.profile._id
  );
  res.json({
    success: true,
    message: result.archived
      ? "Campaign was archived because funds have already been withdrawn"
      : `Campaign deleted and ${result.refundedCredits} credits refunded`,
    data: result
  });
}
