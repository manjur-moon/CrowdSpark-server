import type { Types } from "mongoose";
import { Campaign } from "../../models/Campaign.js";
import { CampaignUpdate } from "../../models/CampaignUpdate.js";
import { Contribution } from "../../models/Contribution.js";
import { Withdrawal } from "../../models/Withdrawal.js";
import { AppError } from "../../utils/AppError.js";
import { paginationMeta, parsePagination } from "../../utils/pagination.js";
import {
  approveContributionTransaction,
  createWithdrawalTransaction,
  rejectContributionTransaction,
  serializeWithdrawal
} from "../financial/financial.service.js";
import type { CampaignUpdateInput, CreatorWithdrawalInput } from "./creator.validation.js";

const contributionSorts: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  credits_high: { credits: -1 },
  credits_low: { credits: 1 }
};

export async function getCreatorDashboard(profile: {
  _id: Types.ObjectId;
  creatorBalance: number;
  reservedCreatorCredits: number;
  lifetimeRaisedCredits: number;
}) {
  const [
    totalCampaigns,
    activeCampaigns,
    pendingCampaigns,
    pendingContributions,
    totals,
    campaignFunds,
    monthlyContributions
  ] = await Promise.all([
    Campaign.countDocuments({ creatorId: profile._id }),
    Campaign.countDocuments({
      creatorId: profile._id,
      status: "approved",
      deadline: { $gt: new Date() }
    }),
    Campaign.countDocuments({ creatorId: profile._id, status: "pending" }),
    Contribution.countDocuments({ creatorId: profile._id, status: "pending" }),
    Campaign.aggregate([
      { $match: { creatorId: profile._id } },
      { $group: { _id: null, raised: { $sum: "$raisedCredits" } } }
    ]),
    Campaign.find({ creatorId: profile._id })
      .select("title raisedCredits goalCredits status")
      .sort({ raisedCredits: -1 })
      .limit(10)
      .lean(),
    Contribution.aggregate([
      {
        $match: {
          creatorId: profile._id,
          status: "approved",
          reviewedAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: { $ifNull: ["$reviewedAt", "$updatedAt"] } }
          },
          credits: { $sum: "$credits" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ])
  ]);

  return {
    totalCampaigns,
    activeCampaigns,
    pendingCampaigns,
    pendingContributions,
    totalRaisedCredits: totals[0]?.raised ?? 0,
    availableCreatorCredits: profile.creatorBalance,
    reservedCreatorCredits: profile.reservedCreatorCredits,
    lifetimeRaisedCredits: profile.lifetimeRaisedCredits,
    campaignFunds: campaignFunds.map((campaign) => ({
      campaignId: campaign._id.toString(),
      title: campaign.title,
      raisedCredits: campaign.raisedCredits,
      goalCredits: campaign.goalCredits,
      status: campaign.status
    })),
    monthlyContributions: monthlyContributions.map((row) => ({
      month: String(row._id),
      credits: Number(row.credits),
      count: Number(row.count)
    }))
  };
}

export async function listCreatorCampaignOptions(creatorId: Types.ObjectId) {
  const campaigns = await Campaign.find({ creatorId }).sort({ createdAt: -1 }).limit(100).lean();
  return campaigns.map((item) => ({
    ...item,
    id: item._id.toString(),
    fundingGoalCredits: item.goalCredits
  }));
}

export async function listCreatorContributions(
  creatorId: Types.ObjectId,
  query: Record<string, unknown>
) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = { creatorId };
  const campaignId = String(query.campaignId ?? "").trim();
  const status = String(query.status ?? "").trim();
  const search = String(query.search ?? "").trim();
  const sort = String(query.sort ?? "newest");
  if (campaignId) filter.campaignId = campaignId;
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { supporterName: { $regex: search, $options: "i" } },
      { supporterEmail: { $regex: search, $options: "i" } }
    ];
  }

  const [items, total] = await Promise.all([
    Contribution.find(filter)
      .sort(contributionSorts[sort] ?? contributionSorts.newest)
      .skip(skip)
      .limit(limit)
      .lean(),
    Contribution.countDocuments(filter)
  ]);

  return {
    data: items.map((item) => ({
      ...item,
      id: item._id.toString(),
      campaignId: item.campaignId.toString(),
      supporter: {
        id: item.supporterId.toString(),
        name: item.supporterName,
        email: item.supporterEmail,
        photoUrl: null
      }
    })),
    meta: paginationMeta(page, limit, total)
  };
}

export function approveCreatorContribution(creatorId: Types.ObjectId, contributionId: string) {
  return approveContributionTransaction({ creatorId, contributionId });
}

export function rejectCreatorContribution(
  creatorId: Types.ObjectId,
  contributionId: string,
  reviewNote: string
) {
  return rejectContributionTransaction({ creatorId, contributionId, reviewNote });
}

async function requireOwnedCampaign(campaignId: string, creatorId: Types.ObjectId) {
  const campaign = await Campaign.findOne({ _id: campaignId, creatorId });
  if (!campaign) throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");
  return campaign;
}

export async function listCampaignUpdates(campaignId: string, creatorId: Types.ObjectId) {
  const campaign = await requireOwnedCampaign(campaignId, creatorId);
  const updates = await CampaignUpdate.find({ campaignId: campaign._id })
    .sort({ createdAt: -1 })
    .lean();
  return updates.map((item) => ({
    ...item,
    id: item._id.toString(),
    campaignId: item.campaignId.toString()
  }));
}

export async function createCampaignUpdate(
  campaignId: string,
  creatorId: Types.ObjectId,
  input: CampaignUpdateInput
) {
  const campaign = await requireOwnedCampaign(campaignId, creatorId);
  return CampaignUpdate.create({ campaignId: campaign._id, creatorId, ...input });
}

export async function updateCampaignUpdate(
  campaignId: string,
  updateId: string,
  creatorId: Types.ObjectId,
  input: CampaignUpdateInput
) {
  const update = await CampaignUpdate.findOneAndUpdate(
    { _id: updateId, campaignId, creatorId },
    input,
    { new: true, runValidators: true }
  );
  if (!update) throw new AppError(404, "UPDATE_NOT_FOUND", "Campaign update not found");
  return update;
}

export async function deleteCampaignUpdate(
  campaignId: string,
  updateId: string,
  creatorId: Types.ObjectId
) {
  const update = await CampaignUpdate.findOneAndDelete({ _id: updateId, campaignId, creatorId });
  if (!update) throw new AppError(404, "UPDATE_NOT_FOUND", "Campaign update not found");
}

export async function listCreatorWithdrawals(
  creatorId: Types.ObjectId,
  query: Record<string, unknown>
) {
  const { page, limit, skip } = parsePagination(query);
  const [items, total] = await Promise.all([
    Withdrawal.find({ creatorId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Withdrawal.countDocuments({ creatorId })
  ]);
  return { data: items.map(serializeWithdrawal), meta: paginationMeta(page, limit, total) };
}

export function createCreatorWithdrawal(
  creatorId: Types.ObjectId,
  input: CreatorWithdrawalInput,
  idempotencyKey: string
) {
  return createWithdrawalTransaction({ creatorId, ...input, idempotencyKey });
}
