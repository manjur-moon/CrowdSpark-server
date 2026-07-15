import { Schema, model, Types } from "mongoose";

export interface ICampaignUpdate {
  campaignId: Types.ObjectId;
  creatorId: Types.ObjectId;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ICampaignUpdate>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true, index: true },
    creatorId: { type: Schema.Types.ObjectId, ref: "UserProfile", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    content: { type: String, required: true, maxlength: 5000 }
  },
  { timestamps: true }
);

schema.index({ campaignId: 1, createdAt: -1 });
export const CampaignUpdate = model<ICampaignUpdate>("CampaignUpdate", schema);
