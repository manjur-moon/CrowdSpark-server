import { Schema, model, Types } from "mongoose";

export interface IWalletTransaction {
  userId: Types.ObjectId;
  type: string;
  credits: number;
  amountCents: number;
  direction: "credit" | "debit";
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IWalletTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "UserProfile", required: true, index: true },
    type: { type: String, required: true, index: true },
    credits: { type: Number, required: true, min: 0 },
    amountCents: { type: Number, default: 0, min: 0 },
    direction: { type: String, enum: ["credit", "debit"], required: true },
    description: { type: String, required: true },
    referenceType: { type: String, default: null },
    referenceId: { type: String, default: null }
  },
  { timestamps: true }
);

schema.index({ userId: 1, createdAt: -1 });
export const WalletTransaction = model<IWalletTransaction>("WalletTransaction", schema);
