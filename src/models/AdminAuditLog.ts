import { Schema, model, Types } from "mongoose";

export interface IAdminAuditLog {
  adminProfileId: Types.ObjectId;
  adminAuthUserId: string;
  adminName: string;
  action: string;
  targetType: "user" | "campaign" | "report" | "withdrawal";
  targetId: string;
  reason: string | null;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IAdminAuditLog>(
  {
    adminProfileId: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
      index: true
    },
    adminAuthUserId: { type: String, required: true, index: true },
    adminName: { type: String, required: true },
    action: { type: String, required: true, index: true },
    targetType: {
      type: String,
      enum: ["user", "campaign", "report", "withdrawal"],
      required: true,
      index: true
    },
    targetId: { type: String, required: true, index: true },
    reason: { type: String, default: null, maxlength: 1000 },
    idempotencyKey: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null }
  },
  { timestamps: true }
);

schema.index({ adminProfileId: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ createdAt: -1, action: 1 });

export const AdminAuditLog = model<IAdminAuditLog>("AdminAuditLog", schema);
