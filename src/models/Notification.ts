import { Schema, model, Types } from "mongoose";

export interface INotification {
  userId: Types.ObjectId;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  isRead: boolean;
  readAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "UserProfile", required: true, index: true },
    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    actionUrl: { type: String, default: null },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

schema.index({ userId: 1, isRead: 1, createdAt: -1 });
export const Notification = model<INotification>("Notification", schema);
