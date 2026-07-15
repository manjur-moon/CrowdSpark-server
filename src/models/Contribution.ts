import { Schema, model, Types } from "mongoose";

export type ContributionStatus =
  "pending" | "approved" | "rejected" | "refund_requested" | "refunded";

export interface IContribution {
  campaignId: Types.ObjectId;
  campaignTitle: string;
  supporterId: Types.ObjectId;
  supporterName: string;
  supporterEmail: string;
  creatorId: Types.ObjectId;
  creatorName: string;
  creatorEmail: string;
  credits: number;
  message: string | null;
  status: ContributionStatus;
  reviewNote: string | null;
  idempotencyKey: string;
  reviewedAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IContribution>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true, index: true },
    campaignTitle: { type: String, required: true },
    supporterId: { type: Schema.Types.ObjectId, ref: "UserProfile", required: true, index: true },
    supporterName: { type: String, required: true },
    supporterEmail: { type: String, required: true },
    creatorId: { type: Schema.Types.ObjectId, ref: "UserProfile", required: true, index: true },
    creatorName: { type: String, required: true },
    creatorEmail: { type: String, required: true },
    credits: { type: Number, required: true, min: 1 },
    message: { type: String, default: null, maxlength: 1000 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "refund_requested", "refunded"],
      default: "pending",
      index: true
    },
    reviewNote: { type: String, default: null },
    idempotencyKey: { type: String, required: true, unique: true },
    reviewedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

schema.index({ supporterId: 1, createdAt: -1 });
schema.index({ creatorId: 1, status: 1, createdAt: -1 });
export const Contribution = model<IContribution>("Contribution", schema);
