import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { jwt } from "better-auth/plugins";
import { env } from "./env.js";
// import { mongoClient, mongoDb } from "./db.js";
import { mongoDb } from "./db.js";
import { UserProfile } from "../models/UserProfile.js";

const socialProviders =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET
        }
      }
    : undefined;

export const auth = betterAuth({
  appName: "CrowdSpark",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.CLIENT_URL],
  // database: mongodbAdapter(mongoDb, { client: mongoClient }),
  database: mongodbAdapter(mongoDb),
  // experimental: { joins: true },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      console.log(`[CrowdSpark password reset] ${user.email}: ${url}`);
    }
  },
  socialProviders,
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 }
  },
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "email-password"],
      allowDifferentEmails: false
    }
  },
  plugins: [
    jwt({
      jwt: {
        expirationTime: "15m",
        issuer: env.BETTER_AUTH_URL,
        audience: `${env.BETTER_AUTH_URL}/api/v1`,
        definePayload: async ({ user, session }) => {
          const profile = await UserProfile.findOne({ authUserId: user.id })
            .select("role status authVersion")
            .lean();

          return {
            type: "access",
            sessionId: session.id,
            name: user.name,
            email: user.email,
            image: user.image ?? null,
            role: profile?.role ?? null,
            status: profile?.status ?? null,
            profileVersion: profile?.authVersion ?? 0
          };
        }
      },
      jwks: {
        rotationInterval: 60 * 60 * 24 * 30,
        gracePeriod: 60 * 60 * 24 * 30
      }
    })
  ],
  advanced: {
  useSecureCookies: env.NODE_ENV === "production",

  ...(env.NODE_ENV === "production"
    ? {
        defaultCookieAttributes: {
          sameSite: "none" as const,
          secure: true,
          httpOnly: true,
          partitioned: true
        }
      }
    : {})
}
});
