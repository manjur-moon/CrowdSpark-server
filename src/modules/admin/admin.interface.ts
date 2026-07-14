import type { Types } from "mongoose";
import type { Role, UserStatus } from "../../types.js";

export interface AdminActor {
  profileId: Types.ObjectId;
  authUserId: string;
  name: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AdminActionIdentity {
  actor: AdminActor;
  idempotencyKey: string;
}

export interface UpdateUserRoleInput extends AdminActionIdentity {
  targetProfileId: string;
  role: Role;
}

export interface UpdateUserStatusInput extends AdminActionIdentity {
  targetProfileId: string;
  status: UserStatus;
  reason?: string;
}

export interface RemoveUserInput extends AdminActionIdentity {
  targetProfileId: string;
  reason: string;
}

export interface ReviewCampaignInput extends AdminActionIdentity {
  campaignId: string;
  action: "approve" | "reject" | "suspend";
  reason?: string;
}

export interface DeleteCampaignInput extends AdminActionIdentity {
  campaignId: string;
  reason: string;
}

export interface ReviewReportInput extends AdminActionIdentity {
  reportId: string;
  action: "resolve" | "dismiss" | "suspend_campaign" | "delete_campaign";
  resolutionNote: string;
}

export interface ReviewWithdrawalInput extends AdminActionIdentity {
  withdrawalId: string;
  action: "approve" | "reject";
  settlementReference?: string;
  reviewNote?: string;
}
