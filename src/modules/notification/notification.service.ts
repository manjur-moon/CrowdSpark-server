import type { Types } from "mongoose";
import { Notification } from "../../models/Notification.js";
import { AppError } from "../../utils/AppError.js";
import { paginationMeta, parsePagination } from "../../utils/pagination.js";

export async function getUnreadCount(userId: Types.ObjectId) {
  return Notification.countDocuments({ userId, isRead: false });
}

export async function listNotifications(userId: Types.ObjectId, query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = { userId };
  const status = String(query.status ?? "").trim();
  const type = String(query.type ?? "").trim();
  if (status === "read") filter.isRead = true;
  if (status === "unread") filter.isRead = false;
  if (type) filter.type = type;
  const sort = String(query.sort ?? "newest") === "oldest" ? 1 : -1;

  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: sort }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter)
  ]);

  return {
    data: items.map((item) => ({ ...item, id: item._id.toString() })),
    meta: paginationMeta(page, limit, total)
  };
}

export async function markAllRead(userId: Types.ObjectId) {
  return Notification.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
}

export async function markOneRead(userId: Types.ObjectId, notificationId: string) {
  const item = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  );
  if (!item) throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
  return item;
}
