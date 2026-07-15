import { Schema, model, Types } from "mongoose";

export interface IReport {
  reporterId: Types.ObjectId;
  reporterName: string;
  reporterEmail: string;
  campaignId: Types.ObjectId;
  campaignTitle: string;
  reason: string;
  description: string | null;
  status: "pending" | "resolved" | "dismissed";
  resolutionNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "UserProfile", required: true, index: true },
    reporterName: { type: String, required: true },
    reporterEmail: { type: String, required: true },
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true, index: true },
    campaignTitle: { type: String, required: true },
    reason: { type: String, required: true },
    description: { type: String, default: null, maxlength: 1000 },
    status: {
      type: String,
      enum: ["pending", "resolved", "dismissed"],
      default: "pending",
      index: true
    },
    resolutionNote: { type: String, default: null },
    resolvedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

schema.index({ status: 1, createdAt: -1 });
export const Report = model<IReport>("Report", schema);
