import type { Types } from "mongoose";

export interface CreateContributionInput {
  supporterId: Types.ObjectId;
  campaignId: string;
  credits: number;
  message?: string;
  idempotencyKey: string;
}

export interface ReviewContributionInput {
  creatorId: Types.ObjectId;
  contributionId: string;
  reviewNote?: string;
}

export interface CreateWithdrawalInput {
  creatorId: Types.ObjectId;
  credits: number;
  method: string;
  accountReference: string;
  idempotencyKey: string;
}

export interface ReviewWithdrawalInput {
  withdrawalId: string;
  reviewNote?: string;
  settlementReference?: string;
}
