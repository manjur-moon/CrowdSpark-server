import { Campaign } from "../../models/Campaign.js";
import { CampaignUpdate } from "../../models/CampaignUpdate.js";
import { ContactMessage } from "../../models/ContactMessage.js";
import { Contribution } from "../../models/Contribution.js";
import { UserProfile } from "../../models/UserProfile.js";
import { AppError } from "../../utils/AppError.js";
import { paginationMeta, parsePagination } from "../../utils/pagination.js";

const SORT_MAP: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  most_funded: { raisedCredits: -1 },
  ending_soon: { deadline: 1 },
  goal_high: { goalCredits: -1 },
  goal_low: { goalCredits: 1 }
};

const DEADLINE_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "60d": 60,
  "90d": 90
};

export function buildPublicCampaignFilter(
  query: Record<string, unknown>,
  now = new Date()
): Record<string, unknown> {
  const search = String(query.search ?? "").trim();
  const category = String(query.category ?? "").trim();
  const status = String(query.status ?? "approved");
  const deadline = String(query.deadline ?? "").trim();
  const minGoal = query.minGoal === undefined ? Number.NaN : Number(query.minGoal);
  const maxGoal = query.maxGoal === undefined ? Number.NaN : Number(query.maxGoal);

  const filter: Record<string, unknown> = { status };
  const deadlineFilter: Record<string, Date> = {};
  if (status === "approved") deadlineFilter.$gt = now;
  if (DEADLINE_DAYS[deadline]) {
    deadlineFilter.$lte = new Date(now.getTime() + DEADLINE_DAYS[deadline] * 86_400_000);
  }
  if (Object.keys(deadlineFilter).length) filter.deadline = deadlineFilter;
  if (category) filter.category = category;

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { title: { $regex: escaped, $options: "i" } },
      { creatorName: { $regex: escaped, $options: "i" } },
      { description: { $regex: escaped, $options: "i" } }
    ];
  }

  const goalFilter: Record<string, number> = {};
  if (Number.isFinite(minGoal) && minGoal >= 0) goalFilter.$gte = minGoal;
  if (Number.isFinite(maxGoal) && maxGoal >= 0) goalFilter.$lte = maxGoal;
  if (Object.keys(goalFilter).length) filter.goalCredits = goalFilter;
  return filter;
}

export async function getPublicStats() {
  const [campaigns, supporters, creators, totals] = await Promise.all([
    Campaign.countDocuments({ status: "approved" }),
    UserProfile.countDocuments({ role: "supporter", status: "active" }),
    UserProfile.countDocuments({ role: "creator", status: "active" }),
    Campaign.aggregate([
      { $match: { status: { $in: ["approved", "completed"] } } },
      { $group: { _id: null, raised: { $sum: "$raisedCredits" } } }
    ])
  ]);
  return { campaigns, supporters, creators, creditsRaised: totals[0]?.raised ?? 0 };
}

export async function getCategories() {
  return (await Campaign.distinct("category", { status: "approved" })).sort();
}

export async function listPublicCampaigns(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const sort = String(query.sort ?? "newest");
  const filter = buildPublicCampaignFilter(query);
  const [items, total] = await Promise.all([
    Campaign.find(filter)
      .sort(SORT_MAP[sort] ?? SORT_MAP.newest)
      .skip(skip)
      .limit(limit)
      .lean(),
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

export async function getPublicCampaign(campaignId: string) {
  const campaign = await Campaign.findById(campaignId).lean();
  if (!campaign || !["approved", "completed"].includes(campaign.status)) {
    throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");
  }
  const supporterCount = await Contribution.distinct("supporterId", {
    campaignId: campaign._id,
    status: "approved"
  }).then((values) => values.length);
  return {
    ...campaign,
    id: campaign._id.toString(),
    fundingGoalCredits: campaign.goalCredits,
    supporterCount,
    creator: {
      id: campaign.creatorId.toString(),
      name: campaign.creatorName,
      email: campaign.creatorEmail
    }
  };
}

export async function getCampaignUpdates(campaignId: string) {
  const updates = await CampaignUpdate.find({ campaignId }).sort({ createdAt: -1 }).lean();
  return updates.map((item) => ({ ...item, id: item._id.toString() }));
}

export async function createContactMessage(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  await ContactMessage.create(input);
}
