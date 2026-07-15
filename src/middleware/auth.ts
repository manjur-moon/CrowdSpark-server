import type { NextFunction, Response } from "express";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../config/auth.js";
import { mongoDb } from "../config/db.js";
import { UserProfile } from "../models/UserProfile.js";
import type { AuthenticatedRequest, Role, SessionUser } from "../types.js";
import { AppError } from "../utils/AppError.js";

function getBearerToken(req: AuthenticatedRequest): string | null {
  const authorization = req.headers.authorization;
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

async function resolveAccessToken(req: AuthenticatedRequest, token: string) {
  let payload: Record<string, unknown> | null = null;
  try {
    const result = await auth.api.verifyJWT({ body: { token } });
    payload = result.payload as Record<string, unknown> | null;
  } catch {
    throw new AppError(401, "INVALID_ACCESS_TOKEN", "Access token is invalid or expired");
  }

  if (!payload || payload.type !== "access" || typeof payload.sub !== "string") {
    throw new AppError(401, "INVALID_ACCESS_TOKEN", "Access token is invalid or expired");
  }

  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
  if (!sessionId || !ObjectId.isValid(sessionId)) {
    throw new AppError(401, "INVALID_ACCESS_TOKEN", "Access token session is invalid");
  }

  const activeSession = await mongoDb
  .collection("session")
  .findOne({
    _id: new ObjectId(sessionId),
    expiresAt: {
      $gt: new Date()
    }
  });

const activeSessionUserId =
  activeSession?.userId
    ? String(activeSession.userId)
    : "";

if (
  !activeSession ||
  activeSessionUserId !== payload.sub
) {
  throw new AppError(
    401,
    "SESSION_REVOKED",
    "This session has expired or was revoked"
  );
}

  const user: SessionUser = {
    id: payload.sub,
    name: typeof payload.name === "string" ? payload.name : "CrowdSpark User",
    email: typeof payload.email === "string" ? payload.email : "",
    image: typeof payload.image === "string" ? payload.image : null
  };

  const profile = await UserProfile.findOne({ authUserId: payload.sub });
  if (!profile) {
    req.sessionUser = user;
    return;
  }

  if ((payload.profileVersion ?? 0) !== profile.authVersion) {
    throw new AppError(401, "ACCESS_TOKEN_REVOKED", "Authorization state changed. Sign in again");
  }

  req.sessionUser = user;
  req.authContext = {
    user,
    profile,
    authMode: "access-token",
    sessionId
  };
}

async function resolveCookieSession(req: AuthenticatedRequest) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session?.user) {
    throw new AppError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue");
  }

  const user: SessionUser = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null
  };

  req.sessionUser = user;
  const profile = await UserProfile.findOne({ authUserId: session.user.id });
  if (profile) {
    req.authContext = {
      user,
      profile,
      authMode: "cookie",
      sessionId: session.session.id
    };
  }
}

export async function requireSession(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const bearerToken = getBearerToken(req);
    if (bearerToken) {
      await resolveAccessToken(req, bearerToken);
    } else {
      await resolveCookieSession(req);
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const context = req.authContext;
  if (!context)
    return next(new AppError(428, "ONBOARDING_REQUIRED", "Complete role onboarding first"));
  if (context.profile.status === "suspended")
    return next(new AppError(403, "ACCOUNT_SUSPENDED", "This account is suspended"));
  if (context.profile.status === "banned")
    return next(new AppError(403, "ACCOUNT_BANNED", "This account is banned"));
  next();
}

export const allowRoles =
  (...roles: Role[]) =>
  (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const role = req.authContext?.profile.role;
    if (!role || !roles.includes(role)) {
      return next(
        new AppError(403, "FORBIDDEN", "You do not have permission to perform this action")
      );
    }
    next();
  };
