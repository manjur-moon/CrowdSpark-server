import { Schema, model, Types } from "mongoose";

export interface IPayment {
  userId: Types.ObjectId;
  userName: string;
  userEmail: string;
  credits: number;
  amountCents: number;
  status: "pending" | "succeeded" | "failed" | "refunded";
  provider: "stripe" | "demo";
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "UserProfile", required: true, index: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    credits: { type: Number, required: true, min: 1 },
    amountCents: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["pending", "succeeded", "failed", "refunded"],
      default: "pending",
      index: true
    },
    provider: { type: String, enum: ["stripe", "demo"], required: true },
    stripeCheckoutSessionId: { type: String, default: null, sparse: true },
    stripePaymentIntentId: { type: String, default: null, sparse: true },
    idempotencyKey: { type: String, required: true, unique: true }
  },
  { timestamps: true }
);

schema.index({ userId: 1, createdAt: -1 });
export const Payment = model<IPayment>("Payment", schema);
