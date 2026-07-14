import { AdminAuditLog } from "../../models/AdminAuditLog.js";
import { Campaign } from "../../models/Campaign.js";
import { Contribution } from "../../models/Contribution.js";
import { Payment } from "../../models/Payment.js";
import { Report } from "../../models/Report.js";
import { UserProfile } from "../../models/UserProfile.js";
import { WalletTransaction } from "../../models/WalletTransaction.js";
import { Withdrawal } from "../../models/Withdrawal.js";
import { paginationMeta, parsePagination } from "../../utils/pagination.js";
import { serializeWithdrawal } from "../financial/financial.service.js";

function dateOrder(query: Record<string, unknown>): 1 | -1 {
  return String(query.sort ?? "newest") === "oldest" ? 1 : -1;
}

export async function getAdminDashboard() {
  const [
    supporters,
    creators,
    totalCampaigns,
    campaignsPending,
    withdrawalsPending,
    openReports,
    profiles,
    payments,
    roleDistribution,
    campaignStatusDistribution,
    monthlyPayments,
    withdrawalDistribution
  ] = await Promise.all([
    UserProfile.countDocuments({ role: "supporter" }),
    UserProfile.countDocuments({ role: "creator" }),
    Campaign.countDocuments(),
    Campaign.countDocuments({ status: "pending" }),
    Withdrawal.countDocuments({ status: "pending" }),
    Report.countDocuments({ status: "pending" }),
    UserProfile.aggregate([{ $group: { _id: null, credits: { $sum: "$credits" } } }]),
    Payment.aggregate([
      { $match: { status: "succeeded" } },
      { $group: { _id: null, amount: { $sum: "$amountCents" }, count: { $sum: 1 } } }
    ]),
    UserProfile.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Campaign.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Payment.aggregate([
      {
        $match: {
          status: "succeeded",
          createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          amountCents: { $sum: "$amountCents" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    Withdrawal.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 }, credits: { $sum: "$credits" } } },
      { $sort: { _id: 1 } }
    ])
  ]);

  return {
    supporters,
    creators,
    totalCampaigns,
    campaignsPending,
    withdrawalsPending,
    openReports,
    totalAvailableCredits: profiles[0]?.credits ?? 0,
    totalPaymentsCents: payments[0]?.amount ?? 0,
    successfulPayments: payments[0]?.count ?? 0,
    roleDistribution: roleDistribution.map((row) => ({
      role: String(row._id),
      count: Number(row.count)
    })),
    campaignStatusDistribution: campaignStatusDistribution.map((row) => ({
      status: String(row._id),
      count: Number(row.count)
    })),
    monthlyPayments: monthlyPayments.map((row) => ({
      month: String(row._id),
      amountCents: Number(row.amountCents),
      count: Number(row.count)
    })),
    withdrawalDistribution: withdrawalDistribution.map((row) => ({
      status: String(row._id),
      count: Number(row.count),
      credits: Number(row.credits)
    }))
  };
}

export async function listAdminUsers(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};
  const search = String(query.search ?? "").trim();
  const role = String(query.role ?? "").trim();
  const status = String(query.status ?? "").trim();
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } }
    ];
  }
  if (role) filter.role = role;
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    UserProfile.find(filter)
      .sort({ createdAt: dateOrder(query) })
      .skip(skip)
      .limit(limit)
      .lean(),
    UserProfile.countDocuments(filter)
  ]);
  return {
    data: items.map((item) => ({ ...item, id: item._id.toString(), emailVerified: true })),
    meta: paginationMeta(page, limit, total)
  };
}

export async function listAdminCampaigns(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};
  const search = String(query.search ?? "").trim();
  const status = String(query.status ?? "").trim();
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { creatorName: { $regex: search, $options: "i" } }
    ];
  }
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    Campaign.find(filter)
      .sort({ createdAt: dateOrder(query) })
      .skip(skip)
      .limit(limit)
      .lean(),
    Campaign.countDocuments(filter)
  ]);
  return {
    data: items.map((item) => ({
      ...item,
      id: item._id.toString(),
      fundingGoalCredits: item.goalCredits,
      creator: { id: item.creatorId.toString(), name: item.creatorName, email: item.creatorEmail }
    })),
    meta: paginationMeta(page, limit, total)
  };
}

export async function listAdminReports(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};
  const status = String(query.status ?? "").trim();
  const search = String(query.search ?? "").trim();
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { campaignTitle: { $regex: search, $options: "i" } },
      { reporterName: { $regex: search, $options: "i" } },
      { reason: { $regex: search, $options: "i" } }
    ];
  }
  const [items, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: dateOrder(query) })
      .skip(skip)
      .limit(limit)
      .lean(),
    Report.countDocuments(filter)
  ]);
  return {
    data: items.map((item) => ({
      ...item,
      id: item._id.toString(),
      reporter: {
        id: item.reporterId.toString(),
        name: item.reporterName,
        email: item.reporterEmail
      },
      target: { id: item.campaignId.toString(), type: "campaign", label: item.campaignTitle }
    })),
    meta: paginationMeta(page, limit, total)
  };
}

export async function listAdminAuditLogs(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};
  const action = String(query.action ?? "").trim();
  const targetType = String(query.targetType ?? "").trim();
  if (action) filter.action = action;
  if (targetType) filter.targetType = targetType;
  const [items, total] = await Promise.all([
    AdminAuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AdminAuditLog.countDocuments(filter)
  ]);
  return {
    data: items.map((item) => ({ ...item, id: item._id.toString() })),
    meta: paginationMeta(page, limit, total)
  };
}

export async function listAdminWithdrawals(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};
  const status = String(query.status ?? "").trim();
  const search = String(query.search ?? "").trim();
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { creatorName: { $regex: search, $options: "i" } },
      { creatorEmail: { $regex: search, $options: "i" } },
      { method: { $regex: search, $options: "i" } },
      { accountReferenceLast4: { $regex: search.slice(-4), $options: "i" } }
    ];
  }
  const [items, total] = await Promise.all([
    Withdrawal.find(filter)
      .sort({ createdAt: dateOrder(query) })
      .skip(skip)
      .limit(limit)
      .lean(),
    Withdrawal.countDocuments(filter)
  ]);
  return {
    data: items.map((item) => ({
      ...serializeWithdrawal(item),
      creator: {
        id: item.creatorId.toString(),
        name: item.creatorName,
        email: item.creatorEmail
      }
    })),
    meta: paginationMeta(page, limit, total)
  };
}

export async function getAdminFinancialSummary() {
  const [payments, contributions, withdrawals] = await Promise.all([
    Payment.aggregate([
      { $match: { status: "succeeded" } },
      {
        $group: {
          _id: null,
          grossPaymentCents: { $sum: "$amountCents" },
          succeededPaymentCount: { $sum: 1 },
          purchasedCredits: { $sum: "$credits" }
        }
      }
    ]),
    Contribution.aggregate([{ $group: { _id: "$status", credits: { $sum: "$credits" } } }]),
    Withdrawal.aggregate([{ $group: { _id: "$status", credits: { $sum: "$credits" } } }])
  ]);
  const contributionByStatus = Object.fromEntries(
    contributions.map((item) => [String(item._id), item.credits])
  );
  const withdrawalByStatus = Object.fromEntries(
    withdrawals.map((item) => [String(item._id), item.credits])
  );
  return {
    grossPaymentCents: payments[0]?.grossPaymentCents ?? 0,
    succeededPaymentCount: payments[0]?.succeededPaymentCount ?? 0,
    purchasedCredits: payments[0]?.purchasedCredits ?? 0,
    contributedCredits: contributionByStatus.approved ?? 0,
    refundedCredits: contributionByStatus.refunded ?? 0,
    pendingWithdrawalCredits: withdrawalByStatus.pending ?? 0,
    approvedWithdrawalCredits: withdrawalByStatus.approved ?? 0,
    platformFeeCents: 0
  };
}

export async function listAdminPayments(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};
  const status = String(query.status ?? "").trim();
  const search = String(query.search ?? "").trim();
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { userName: { $regex: search, $options: "i" } },
      { userEmail: { $regex: search, $options: "i" } },
      { stripePaymentIntentId: { $regex: search, $options: "i" } }
    ];
  }
  const [items, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: dateOrder(query) })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter)
  ]);
  return {
    data: items.map((item) => ({
      ...item,
      id: item._id.toString(),
      user: { id: item.userId.toString(), name: item.userName, email: item.userEmail }
    })),
    meta: paginationMeta(page, limit, total)
  };
}

export async function listAdminLedger(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};
  const type = String(query.type ?? "").trim();
  if (type) filter.type = type;
  const [items, total] = await Promise.all([
    WalletTransaction.find(filter)
      .sort({ createdAt: dateOrder(query) })
      .skip(skip)
      .limit(limit)
      .lean(),
    WalletTransaction.countDocuments(filter)
  ]);
  return {
    data: items.map((item) => ({
      ...item,
      id: item._id.toString(),
      debitAccount: item.direction === "debit" ? item.userId.toString() : "platform",
      creditAccount: item.direction === "credit" ? item.userId.toString() : "platform"
    })),
    meta: paginationMeta(page, limit, total)
  };
}
