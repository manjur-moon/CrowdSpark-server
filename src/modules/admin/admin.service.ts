import { ObjectId } from "mongodb";
import { Campaign } from "../../models/Campaign.js";
import { AdminAuditLog } from "../../models/AdminAuditLog.js";
import { Notification } from "../../models/Notification.js";
import { Report } from "../../models/Report.js";
import { UserProfile } from "../../models/UserProfile.js";
import { Withdrawal } from "../../models/Withdrawal.js";
import { mongoDb } from "../../config/db.js";
import {
  approveWithdrawalTransaction,
  deleteCreatorCampaignTransaction,
  rejectWithdrawalTransaction
} from "../financial/financial.service.js";
import { createNotification } from "../../services/notification.service.js";
import { AppError } from "../../utils/AppError.js";
import { runInTransaction } from "../../utils/transaction.js";
import type {
  AdminActor,
  DeleteCampaignInput,
  RemoveUserInput,
  ReviewCampaignInput,
  ReviewReportInput,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
  ReviewWithdrawalInput
} from "./admin.interface.js";

function authDocumentId(authUserId: string): ObjectId | string {
  return ObjectId.isValid(authUserId) ? new ObjectId(authUserId) : authUserId;
}

async function revokeUserSessions(authUserId: string): Promise<void> {
  await mongoDb.collection("session").deleteMany({ userId: authUserId });
}

async function removeBetterAuthIdentity(authUserId: string, email: string): Promise<void> {
  await Promise.all([
    mongoDb.collection("session").deleteMany({ userId: authUserId }),
    mongoDb.collection("account").deleteMany({ userId: authUserId }),
    mongoDb.collection("verification").deleteMany({
      $or: [{ identifier: email }, { value: email }]
    }),
    mongoDb
      .collection<Record<string, unknown>>("user")
      .deleteOne({ _id: authDocumentId(authUserId) as never })
  ]);
}

async function findAuditRetry(actor: AdminActor, idempotencyKey: string) {
  return AdminAuditLog.findOne({ adminProfileId: actor.profileId, idempotencyKey }).lean();
}

async function writeAudit(input: {
  actor: AdminActor;
  idempotencyKey: string;
  action: string;
  targetType: "user" | "campaign" | "report" | "withdrawal";
  targetId: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return AdminAuditLog.create({
    adminProfileId: input.actor.profileId,
    adminAuthUserId: input.actor.authUserId,
    adminName: input.actor.name,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason ?? null,
    idempotencyKey: input.idempotencyKey,
    metadata: input.metadata ?? {},
    ipAddress: input.actor.ipAddress ?? null,
    userAgent: input.actor.userAgent ?? null
  });
}

async function protectFinalAdmin(
  target: { role: string; status: string },
  nextRole?: string,
  nextStatus?: string
) {
  const removesActiveAdmin =
    target.role === "admin" &&
    target.status === "active" &&
    ((nextRole !== undefined && nextRole !== "admin") ||
      (nextStatus !== undefined && nextStatus !== "active"));

  if (!removesActiveAdmin) return;
  const activeAdmins = await UserProfile.countDocuments({ role: "admin", status: "active" });
  if (activeAdmins <= 1) {
    throw new AppError(
      409,
      "FINAL_ADMIN_PROTECTED",
      "The final active Admin cannot be changed or removed"
    );
  }
}

export async function updateUserRoleSecure(input: UpdateUserRoleInput) {
  const retry = await findAuditRetry(input.actor, input.idempotencyKey);
  if (retry) {
    const current = await UserProfile.findById(input.targetProfileId);
    return { user: current, idempotentRetry: true };
  }

  if (input.targetProfileId === input.actor.profileId.toString()) {
    throw new AppError(403, "SELF_ROLE_CHANGE_BLOCKED", "You cannot change your own role");
  }

  const target = await UserProfile.findById(input.targetProfileId);
  if (!target) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  await protectFinalAdmin(target, input.role, undefined);

  const previousRole = target.role;
  target.role = input.role;
  target.authVersion += 1;
  await target.save();
  await revokeUserSessions(target.authUserId);

  await Promise.all([
    createNotification({
      userId: target._id,
      type: "role_changed",
      title: "Account role updated",
      message: `Your CrowdSpark role changed from ${previousRole} to ${input.role}. Please sign in again.`,
      actionUrl: "/login"
    }),
    writeAudit({
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      action: "user.role.changed",
      targetType: "user",
      targetId: target._id.toString(),
      metadata: { previousRole, nextRole: input.role, authUserId: target.authUserId }
    })
  ]);

  return { user: target, idempotentRetry: false };
}

export async function updateUserStatusSecure(input: UpdateUserStatusInput) {
  const retry = await findAuditRetry(input.actor, input.idempotencyKey);
  if (retry) {
    const current = await UserProfile.findById(input.targetProfileId);
    return { user: current, idempotentRetry: true };
  }

  if (input.targetProfileId === input.actor.profileId.toString()) {
    throw new AppError(403, "SELF_STATUS_CHANGE_BLOCKED", "You cannot change your own status");
  }
  if (input.status !== "active" && (!input.reason || input.reason.trim().length < 10)) {
    throw new AppError(422, "REASON_REQUIRED", "Provide a reason of at least 10 characters");
  }

  const target = await UserProfile.findById(input.targetProfileId);
  if (!target) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  await protectFinalAdmin(target, undefined, input.status);

  const previousStatus = target.status;
  target.status = input.status;
  target.authVersion += 1;
  await target.save();
  await revokeUserSessions(target.authUserId);

  await Promise.all([
    createNotification({
      userId: target._id,
      type: "account_status_changed",
      title: "Account status updated",
      message: input.reason
        ? `Your account is ${input.status}: ${input.reason}`
        : `Your account is ${input.status}`,
      actionUrl: input.status === "active" ? "/login" : "/"
    }),
    writeAudit({
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      action: "user.status.changed",
      targetType: "user",
      targetId: target._id.toString(),
      reason: input.reason,
      metadata: { previousStatus, nextStatus: input.status, authUserId: target.authUserId }
    })
  ]);

  return { user: target, idempotentRetry: false };
}

export async function removeUserSecure(input: RemoveUserInput) {
  const retry = await findAuditRetry(input.actor, input.idempotencyKey);
  if (retry) return { removed: true, idempotentRetry: true };
  if (input.targetProfileId === input.actor.profileId.toString()) {
    throw new AppError(403, "SELF_DELETE_BLOCKED", "You cannot remove your own account");
  }

  const target = await UserProfile.findById(input.targetProfileId);
  if (!target) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  await protectFinalAdmin(target, "supporter", "banned");

  const [campaignCount, pendingWithdrawalCount] = await Promise.all([
    Campaign.countDocuments({ creatorId: target._id }),
    Withdrawal.countDocuments({ creatorId: target._id, status: "pending" })
  ]);

  if (campaignCount > 0) {
    throw new AppError(
      409,
      "DELETE_CAMPAIGNS_FIRST",
      "Delete or archive this Creator's campaigns before removing the account"
    );
  }
  if (pendingWithdrawalCount > 0 || target.reservedCreatorCredits > 0) {
    throw new AppError(
      409,
      "FINANCIAL_OBLIGATION_EXISTS",
      "Resolve pending withdrawals before removing this account"
    );
  }

  await runInTransaction(async (session) => {
    await Notification.deleteMany({ userId: target._id }).session(session);
    await Report.deleteMany({ reporterId: target._id }).session(session);
    await AdminAuditLog.create(
      [
        {
          adminProfileId: input.actor.profileId,
          adminAuthUserId: input.actor.authUserId,
          adminName: input.actor.name,
          action: "user.removed",
          targetType: "user",
          targetId: target._id.toString(),
          reason: input.reason,
          idempotencyKey: input.idempotencyKey,
          metadata: { authUserId: target.authUserId, email: target.email, role: target.role },
          ipAddress: input.actor.ipAddress ?? null,
          userAgent: input.actor.userAgent ?? null
        }
      ],
      { session }
    );
    await target.deleteOne({ session });
  });

  await removeBetterAuthIdentity(target.authUserId, target.email);
  return { removed: true, idempotentRetry: false };
}

export async function reviewCampaignSecure(input: ReviewCampaignInput) {
  const retry = await findAuditRetry(input.actor, input.idempotencyKey);
  if (retry) {
    const current = await Campaign.findById(input.campaignId);
    return { campaign: current, idempotentRetry: true };
  }

  const campaign = await Campaign.findById(input.campaignId);
  if (!campaign) throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");

  const previousStatus = campaign.status;
  if (input.action === "approve") {
    if (campaign.status !== "pending")
      throw new AppError(409, "CAMPAIGN_NOT_PENDING", "Only pending campaigns can be approved");
    campaign.status = "approved";
    campaign.rejectionReason = null;
    campaign.moderationReason = null;
    campaign.suspendedAt = null;
  } else if (input.action === "reject") {
    if (campaign.status !== "pending")
      throw new AppError(409, "CAMPAIGN_NOT_PENDING", "Only pending campaigns can be rejected");
    if (!input.reason || input.reason.trim().length < 10)
      throw new AppError(422, "REASON_REQUIRED", "Provide a rejection reason");
    campaign.status = "rejected";
    campaign.rejectionReason = input.reason.trim();
  } else {
    if (!["approved", "pending"].includes(campaign.status))
      throw new AppError(
        409,
        "CAMPAIGN_NOT_SUSPENDABLE",
        "Only pending or approved campaigns can be suspended"
      );
    if (!input.reason || input.reason.trim().length < 10)
      throw new AppError(422, "REASON_REQUIRED", "Provide a suspension reason");
    campaign.status = "suspended";
    campaign.moderationReason = input.reason.trim();
    campaign.suspendedAt = new Date();
  }

  campaign.reviewedAt = new Date();
  await campaign.save();

  const notificationType =
    input.action === "approve"
      ? "campaign_approved"
      : input.action === "reject"
        ? "campaign_rejected"
        : "campaign_suspended";
  const title =
    input.action === "approve"
      ? "Campaign approved"
      : input.action === "reject"
        ? "Campaign needs changes"
        : "Campaign suspended";
  const message =
    input.action === "approve"
      ? `${campaign.title} is now live`
      : `${campaign.title} was ${input.action === "reject" ? "rejected" : "suspended"}: ${input.reason}`;

  await Promise.all([
    createNotification({
      userId: campaign.creatorId,
      type: notificationType,
      title,
      message,
      actionUrl:
        input.action === "approve"
          ? `/campaigns/${campaign._id.toString()}`
          : "/dashboard/creator/campaigns"
    }),
    writeAudit({
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      action: `campaign.${input.action}`,
      targetType: "campaign",
      targetId: campaign._id.toString(),
      reason: input.reason,
      metadata: { previousStatus, nextStatus: campaign.status, title: campaign.title }
    })
  ]);

  return { campaign, idempotentRetry: false };
}

export async function deleteCampaignSecure(input: DeleteCampaignInput) {
  const retry = await findAuditRetry(input.actor, input.idempotencyKey);
  if (retry) return { result: retry.metadata, idempotentRetry: true };

  const campaign = await Campaign.findById(input.campaignId);
  if (!campaign) throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");
  const campaignSnapshot = {
    title: campaign.title,
    creatorId: campaign.creatorId.toString(),
    status: campaign.status
  };

  const result = await deleteCreatorCampaignTransaction({
    campaignId: campaign._id.toString(),
    creatorId: campaign.creatorId
  });

  await writeAudit({
    actor: input.actor,
    idempotencyKey: input.idempotencyKey,
    action: result.archived ? "campaign.archived" : "campaign.deleted",
    targetType: "campaign",
    targetId: input.campaignId,
    reason: input.reason,
    metadata: { ...campaignSnapshot, ...result }
  });

  return { result, idempotentRetry: false };
}

export async function reviewReportSecure(input: ReviewReportInput) {
  const retry = await findAuditRetry(input.actor, input.idempotencyKey);
  if (retry) {
    const current = await Report.findById(input.reportId);
    return { report: current, idempotentRetry: true };
  }

  const report = await Report.findOne({ _id: input.reportId, status: "pending" });
  if (!report)
    throw new AppError(409, "REPORT_NOT_PENDING", "Only pending reports can be reviewed");

  let campaignAction: Record<string, unknown> | null = null;
  if (input.action === "suspend_campaign") {
    const result = await reviewCampaignSecure({
      actor: input.actor,
      idempotencyKey: `${input.idempotencyKey}:campaign`,
      campaignId: report.campaignId.toString(),
      action: "suspend",
      reason: input.resolutionNote
    });
    campaignAction = { campaignId: report.campaignId.toString(), status: result.campaign?.status };
  } else if (input.action === "delete_campaign") {
    const result = await deleteCampaignSecure({
      actor: input.actor,
      idempotencyKey: `${input.idempotencyKey}:campaign`,
      campaignId: report.campaignId.toString(),
      reason: input.resolutionNote
    });
    campaignAction = result.result as Record<string, unknown>;
  }

  report.status = input.action === "dismiss" ? "dismissed" : "resolved";
  report.resolutionNote = input.resolutionNote;
  report.resolvedAt = new Date();
  await report.save();

  await writeAudit({
    actor: input.actor,
    idempotencyKey: input.idempotencyKey,
    action: `report.${input.action}`,
    targetType: "report",
    targetId: report._id.toString(),
    reason: input.resolutionNote,
    metadata: { campaignId: report.campaignId.toString(), campaignAction }
  });

  return { report, idempotentRetry: false };
}

export async function reviewWithdrawalSecure(input: ReviewWithdrawalInput) {
  const retry = await findAuditRetry(input.actor, input.idempotencyKey);
  if (retry) {
    const current = await Withdrawal.findById(input.withdrawalId);
    return { withdrawal: current, idempotentRetry: true };
  }

  const result =
    input.action === "approve"
      ? await approveWithdrawalTransaction({
          withdrawalId: input.withdrawalId,
          settlementReference: input.settlementReference ?? "",
          reviewNote: input.reviewNote
        })
      : await rejectWithdrawalTransaction({
          withdrawalId: input.withdrawalId,
          reviewNote: input.reviewNote ?? ""
        });

  await writeAudit({
    actor: input.actor,
    idempotencyKey: input.idempotencyKey,
    action: `withdrawal.${input.action === "approve" ? "approved" : "rejected"}`,
    targetType: "withdrawal",
    targetId: input.withdrawalId,
    reason: input.reviewNote,
    metadata: input.action === "approve" ? { settlementReference: input.settlementReference } : {}
  });

  return { withdrawal: result.withdrawal, idempotentRetry: result.idempotentRetry };
}
