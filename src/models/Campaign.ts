import { Schema, model, Types } from "mongoose";

export type CampaignStatus =
  "draft" | "pending" | "approved" | "rejected" | "suspended" | "completed" | "archived";

export interface ICampaign {
  creatorId: Types.ObjectId;
  creatorName: string;
  creatorEmail: string;
  title: string;
  story: string;
  description: string;
  category: string;
  goalCredits: number;
  minimumContribution: number;
  raisedCredits: number;
  availableBalanceCredits: number;
  withdrawnCredits: number;
  deadline: Date;
  rewardInfo: string;
  coverImageUrl: string;
  gallery: string[];
  location: string;
  status: CampaignStatus;
  rejectionReason: string | null;
  moderationReason: string | null;
  suspendedAt: Date | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ICampaign>(
  {
    creatorId: { type: Schema.Types.ObjectId, ref: "UserProfile", required: true, index: true },
    creatorName: { type: String, required: true },
    creatorEmail: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    story: { type: String, required: true, maxlength: 10000 },
    description: { type: String, required: true, maxlength: 500 },
    category: { type: String, required: true, trim: true, index: true },
    goalCredits: { type: Number, required: true, min: 100 },
    minimumContribution: { type: Number, required: true, min: 1, default: 1 },
    raisedCredits: { type: Number, min: 0, default: 0 },
    availableBalanceCredits: { type: Number, min: 0, default: 0 },
    withdrawnCredits: { type: Number, min: 0, default: 0 },
    deadline: { type: Date, required: true, index: true },
    rewardInfo: { type: String, default: "" },
    coverImageUrl: { type: String, required: true },
    gallery: [{ type: String }],
    location: { type: String, default: "Global" },
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected", "suspended", "completed", "archived"],
      default: "pending",
      index: true
    },
    rejectionReason: { type: String, default: null },
    moderationReason: { type: String, default: null },
    suspendedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

schema.index({ status: 1, deadline: 1, raisedCredits: -1 });
schema.index({ title: "text", story: "text", category: "text" });
export const Campaign = model<ICampaign>("Campaign", schema);
