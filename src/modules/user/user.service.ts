import type { SessionUser } from "../../types.js";
import { UserProfile } from "../../models/UserProfile.js";
import { WalletTransaction } from "../../models/WalletTransaction.js";
import { AppError } from "../../utils/AppError.js";
import { paginationMeta, parsePagination } from "../../utils/pagination.js";

export async function getCurrentUser(sessionUser: SessionUser) {
  const profile = await UserProfile.findOne({ authUserId: sessionUser.id });
  if (profile) {
    profile.name = sessionUser.name;
    profile.email = sessionUser.email.toLowerCase();
    profile.image = sessionUser.image ?? profile.image;
    await profile.save();
  }

  return {
    user: sessionUser,
    profile: profile ? { ...profile.toObject(), id: profile._id.toString() } : null,
    onboardingCompleted: Boolean(profile)
  };
}

export async function completeOnboarding(sessionUser: SessionUser, role: "supporter" | "creator") {
  const existing = await UserProfile.findOne({ authUserId: sessionUser.id });
  if (existing) {
    if (existing.role !== role) {
      throw new AppError(409, "ONBOARDING_ALREADY_COMPLETED", "Role has already been selected");
    }
    return { profile: existing, created: false };
  }

  const credits = role === "supporter" ? 50 : 20;
  const profile = await UserProfile.create({
    authUserId: sessionUser.id,
    name: sessionUser.name,
    email: sessionUser.email,
    image: sessionUser.image ?? null,
    role,
    status: "active",
    onboardingCompleted: true,
    credits,
    creatorBalance: 0,
    reservedCreatorCredits: 0,
    lifetimeRaisedCredits: 0
  });

  await WalletTransaction.create({
    userId: profile._id,
    type: "registration_bonus",
    credits,
    direction: "credit",
    amountCents: 0,
    description: `${role} registration bonus`
  });

  return { profile, created: true };
}

export async function listWalletTransactions(
  userId: typeof UserProfile.prototype._id,
  query: Record<string, unknown>
) {
  const { page, limit, skip } = parsePagination(query);
  const [items, total] = await Promise.all([
    WalletTransaction.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    WalletTransaction.countDocuments({ userId })
  ]);

  return {
    data: items.map((item) => ({ ...item, id: item._id.toString() })),
    meta: paginationMeta(page, limit, total)
  };
}
