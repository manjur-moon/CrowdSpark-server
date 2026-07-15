import type { Types } from "mongoose";
import { Campaign } from "../../models/Campaign.js";
import { deleteCreatorCampaignTransaction } from "../financial/financial.service.js";
import type { CampaignInput, CampaignUpdateInput } from "./campaign.validation.js";
import { AppError } from "../../utils/AppError.js";
import { paginationMeta, parsePagination } from "../../utils/pagination.js";

export async function listCreatorCampaigns(
  creatorId: Types.ObjectId,
  query: Record<string, unknown>
) {
  const { page, limit, skip } = parsePagination(query);
  const status = String(query.status ?? "").trim();
  const filter: Record<string, unknown> = { creatorId };
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    Campaign.find(filter).sort({ deadline: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Campaign.countDocuments(filter)
  ]);

  return {
    data: items.map((item) => ({
      ...item,
      id: item._id.toString(),
      fundingGoalCredits: item.goalCredits
    })),
    meta: paginationMeta(page, limit, total)
  };
}

export async function createCampaign(
  creator: {
    id: Types.ObjectId;
    name: string;
    email: string;
  },
  input: CampaignInput
) {
  if (input.deadline.getTime() <= Date.now()) {
    throw new AppError(422, "INVALID_DEADLINE", "Deadline must be in the future");
  }

  return Campaign.create({
    ...input,
    creatorId: creator.id,
    creatorName: creator.name,
    creatorEmail: creator.email,
    raisedCredits: 0,
    availableBalanceCredits: 0,
    withdrawnCredits: 0,
    status: "pending",
    submittedAt: new Date()
  });
}

export async function updateCreatorCampaign(
  campaignId: string,
  creatorId: Types.ObjectId,
  input: CampaignUpdateInput
) {
  if (input.deadline && input.deadline.getTime() <= Date.now()) {
    throw new AppError(422, "INVALID_DEADLINE", "Deadline must be in the future");
  }

  const campaign = await Campaign.findOne({ _id: campaignId, creatorId });
  if (!campaign) throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");
  if (!["draft", "pending", "rejected"].includes(campaign.status)) {
    throw new AppError(409, "CAMPAIGN_LOCKED", "Approved campaigns cannot be edited directly");
  }

  Object.assign(campaign, input, {
    status: "pending",
    rejectionReason: null,
    moderationReason: null,
    submittedAt: new Date()
  });
  await campaign.save();
  return campaign;
}

export async function deleteCreatorCampaign(campaignId: string, creatorId: Types.ObjectId) {
  return deleteCreatorCampaignTransaction({ campaignId, creatorId });
}
