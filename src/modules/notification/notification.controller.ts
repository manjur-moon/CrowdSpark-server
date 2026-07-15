import type { Response } from "express";
import type { AuthenticatedRequest } from "../../types.js";
import {
  getUnreadCount,
  listNotifications,
  markAllRead,
  markOneRead
} from "./notification.service.js";

export async function unreadCount(req: AuthenticatedRequest, res: Response) {
  const count = await getUnreadCount(req.authContext!.profile._id);
  res.json({ success: true, data: { count } });
}

export async function list(req: AuthenticatedRequest, res: Response) {
  const result = await listNotifications(
    req.authContext!.profile._id,
    req.query as Record<string, unknown>
  );
  res.json({ success: true, ...result });
}

export async function readAll(req: AuthenticatedRequest, res: Response) {
  const result = await markAllRead(req.authContext!.profile._id);
  res.json({
    success: true,
    message: "All notifications marked as read",
    data: { modifiedCount: result.modifiedCount }
  });
}

export async function readOne(req: AuthenticatedRequest, res: Response) {
  const item = await markOneRead(req.authContext!.profile._id, String(req.params.notificationId));
  res.json({ success: true, data: { ...item.toObject(), id: item._id.toString() } });
}
