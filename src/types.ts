import type { Request } from "express";
import type { HydratedDocument } from "mongoose";
import type { IUserProfile } from "./models/UserProfile.js";

export type Role = "supporter" | "creator" | "admin";
export type UserStatus = "active" | "suspended" | "banned";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface AuthContext {
  user: SessionUser;
  profile: HydratedDocument<IUserProfile>;
  authMode: "cookie" | "access-token";
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  authContext?: AuthContext;
  sessionUser?: SessionUser;
}
