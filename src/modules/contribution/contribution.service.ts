import type { Types } from "mongoose";
import { Contribution } from "../../models/Contribution.js";
import { createNotification } from "../../services/notification.service.js";
import { AppError } from "../../utils/AppError.js";
import { paginationMeta, parsePagination } from "../../utils/pagination.js";
import { createContributionTransaction } from "../financial/financial.service.js";
import type { CreateContributionInput, RefundRequestInput } from "./contribution.validation.js";

const contributionSorts: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  credits_high: { credits: -1 },
  credits_low: { credits: 1 }
};

export async function getSupporterDashboard(supporterId: Types.ObjectId, availableCredits: number) {
  const [statusRows, monthlyRows] = await Promise.all([
    Contribution.aggregate([
      { $match: { supporterId } },
      { $group: { _id: "$status", count: { $sum: 1 }, credits: { $sum: "$credits" } } },
      { $sort: { _id: 1 } }
    ]),
    Contribution.aggregate([
      {
        $match: {
          supporterId,
          status: "approved",
          createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          credits: { $sum: "$credits" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ])
  ]);

  const byStatus = Object.fromEntries(
    statusRows.map((row) => [String(row._id), { count: row.count, credits: row.credits }])
  );

  return {
    totalContributions: statusRows.reduce((sum, row) => sum + Number(row.count ?? 0), 0),
    pendingContributions: byStatus.pending?.count ?? 0,
    approvedContributionCredits: byStatus.approved?.credits ?? 0,
    availableCredits,
    statusDistribution: statusRows.map((row) => ({
      status: String(row._id),
      count: Number(row.count),
      credits: Number(row.credits)
    })),
    monthlyContributions: monthlyRows.map((row) => ({
      month: String(row._id),
      credits: Number(row.credits),
      count: Number(row.count)
    }))
  };
}

export async function submitContribution(
  supporterId: Types.ObjectId,
  input: CreateContributionInput,
  idempotencyKey: string
) {
  return createContributionTransaction({
    supporterId,
    campaignId: input.campaignId,
    credits: input.credits,
    message: input.message,
    idempotencyKey
  });
}

export async function listSupporterContributions(
  supporterId: Types.ObjectId,
  query: Record<string, unknown>
) {
  const { page, limit, skip } = parsePagination(query);
  const status = String(query.status ?? "").trim();
  const search = String(query.search ?? "").trim();
  const sort = String(query.sort ?? "newest");
  const filter: Record<string, unknown> = { supporterId };
  if (status) filter.status = status;
  if (search) filter.campaignTitle = { $regex: search, $options: "i" };

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
      campaign: {
        id: item.campaignId.toString(),
        title: item.campaignTitle,
        coverImageUrl: null
      }
    })),
    meta: paginationMeta(page, limit, total)
  };
}

export async function getSupporterContribution(
  contributionId: string,
  supporterId: Types.ObjectId
) {
  const item = await Contribution.findOne({ _id: contributionId, supporterId }).lean();
  if (!item) throw new AppError(404, "CONTRIBUTION_NOT_FOUND", "Contribution not found");

  return {
    ...item,
    id: item._id.toString(),
    campaign: {
      id: item.campaignId.toString(),
      title: item.campaignTitle,
      coverImageUrl: null
    },
    refundEligibility: {
      eligible: item.status === "approved",
      reason:
        item.status === "approved" ? null : "Only approved contributions can request a refund",
      refundableCredits: item.credits,
      expiresAt: null
    },
    refundRequest:
      item.status === "refund_requested"
        ? {
            id: item._id.toString(),
            status: "pending",
            credits: item.credits,
            reason: item.reviewNote ?? "Refund requested",
            requestedAt: item.updatedAt
          }
        : null
  };
}

export async function requestContributionRefund(
  contributionId: string,
  supporterId: Types.ObjectId,
  input: RefundRequestInput
) {
  const contribution = await Contribution.findOneAndUpdate(
    { _id: contributionId, supporterId, status: "approved" },
    { $set: { status: "refund_requested", reviewNote: input.reason } },
    { new: true }
  );

  if (!contribution) {
    throw new AppError(
      409,
      "REFUND_NOT_AVAILABLE",
      "This contribution is not eligible for a refund request"
    );
  }

  await createNotification({
    userId: contribution.creatorId,
    type: "refund_requested",
    title: "Refund requested",
    message: `${contribution.supporterName} requested a refund for ${contribution.campaignTitle}`,
    actionUrl: "/dashboard/creator/contributions"
  });

  return contribution;
}
