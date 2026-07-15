import { Schema, model, Types } from "mongoose";

export interface IWithdrawal {
  creatorId: Types.ObjectId;
  creatorName: string;
  creatorEmail: string;
  credits: number;
  amountCents: number;
  method: string;
  accountReferenceEncrypted: string;
  accountReferenceLast4: string;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  settlementReference: string | null;
  idempotencyKey: string;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IWithdrawal>(
  {
    creatorId: { type: Schema.Types.ObjectId, ref: "UserProfile", required: true, index: true },
    creatorName: { type: String, required: true },
    creatorEmail: { type: String, required: true },
    credits: { type: Number, required: true, min: 200 },
    amountCents: { type: Number, required: true, min: 1000 },
    method: { type: String, required: true, trim: true, index: true },
    accountReferenceEncrypted: { type: String, required: true, select: false },
    accountReferenceLast4: { type: String, required: true, minlength: 4, maxlength: 4 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true
    },
    reviewNote: { type: String, default: null },
    settlementReference: { type: String, default: null },
    idempotencyKey: { type: String, required: true, unique: true },
    reviewedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

schema.index({ creatorId: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
export const Withdrawal = model<IWithdrawal>("Withdrawal", schema);
