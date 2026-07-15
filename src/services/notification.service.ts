import type { ClientSession, Types } from "mongoose";
import { Notification } from "../models/Notification.js";

export async function createNotification(
  input: {
    userId: Types.ObjectId;
    type: string;
    title: string;
    message: string;
    actionUrl?: string | null;
    metadata?: Record<string, unknown>;
  },
  session?: ClientSession
) {
  const payload = [
    {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      actionUrl: input.actionUrl ?? null,
      metadata: input.metadata ?? {}
    }
  ];

  const [notification] = session
    ? await Notification.create(payload, { session })
    : await Notification.create(payload);

  if (!notification) {
    throw new Error("Notification could not be created");
  }

  return notification;
}
