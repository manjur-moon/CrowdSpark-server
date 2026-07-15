import { Schema, model } from "mongoose";
import type { Role, UserStatus } from "../types.js";

export interface IUserProfile {
  authUserId: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  status: UserStatus;
  onboardingCompleted: boolean;
  authVersion: number;
  credits: number;
  creatorBalance: number;
  reservedCreatorCredits: number;
  lifetimeRaisedCredits: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IUserProfile>(
  {
    authUserId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    image: { type: String, default: null },
    role: { type: String, enum: ["supporter", "creator", "admin"], required: true },
    status: { type: String, enum: ["active", "suspended", "banned"], default: "active" },
    onboardingCompleted: { type: Boolean, default: true },
    authVersion: { type: Number, min: 1, default: 1 },
    credits: { type: Number, min: 0, default: 0 },
    creatorBalance: { type: Number, min: 0, default: 0 },
    reservedCreatorCredits: { type: Number, min: 0, default: 0 },
    lifetimeRaisedCredits: { type: Number, min: 0, default: 0 }
  },
  { timestamps: true }
);

schema.index({ role: 1, status: 1 });
export const UserProfile = model<IUserProfile>("UserProfile", schema);
