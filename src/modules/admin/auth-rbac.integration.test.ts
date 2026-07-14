import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

let replicaSet: MongoMemoryReplSet | undefined;
let app: typeof import("../../app.js").app;
let connectDatabase: typeof import("../../config/db.js").connectDatabase;
let disconnectDatabase: typeof import("../../config/db.js").disconnectDatabase | undefined;
let mongoDb: typeof import("../../config/db.js").mongoDb;
let UserProfile: typeof import("../../models/UserProfile.js").UserProfile;
let AdminAuditLog: typeof import("../../models/AdminAuditLog.js").AdminAuditLog;
let Campaign: typeof import("../../models/Campaign.js").Campaign;
let adminService: typeof import("./admin.service.js");

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" }
  });

  process.env.NODE_ENV = "test";
  process.env.PORT = "5000";
  process.env.MONGODB_URI = replicaSet.getUri();
  process.env.MONGODB_DB_NAME = "crowdspark_auth_test";
  process.env.CLIENT_URL = "http://localhost:5173";
  process.env.BETTER_AUTH_URL = "http://localhost:5000";
  process.env.BETTER_AUTH_SECRET = "test_secret_that_is_longer_than_thirty_two_characters";
  process.env.WITHDRAWAL_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  process.env.DEMO_PAYMENTS = "true";

  const dbModule = await import("../../config/db.js");
  connectDatabase = dbModule.connectDatabase;
  disconnectDatabase = dbModule.disconnectDatabase;
  mongoDb = dbModule.mongoDb;

  await connectDatabase();

  ({ app } = await import("../../app.js"));
  ({ UserProfile } = await import("../../models/UserProfile.js"));
  ({ AdminAuditLog } = await import("../../models/AdminAuditLog.js"));
  ({ Campaign } = await import("../../models/Campaign.js"));
  adminService = await import("./admin.service.js");
}, 60_000);

afterEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    await Promise.all(
      Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({}))
    );
  }

  if (mongoDb) {
    await Promise.all(
      ["user", "session", "account", "verification", "jwks"].map((name) =>
        mongoDb.collection(name).deleteMany({})
      )
    );
  }
});

afterAll(async () => {
  if (disconnectDatabase) await disconnectDatabase();
  if (replicaSet) await replicaSet.stop();
}, 60_000);

describe("JWT access token and RBAC hardening", () => {
  it("authenticates an API request with a short-lived Better Auth JWT", async () => {
    const agent = request.agent(app);
    const email = "jwt-supporter@crowdspark.test";

    const signup = await agent.post("/api/auth/sign-up/email").send({
      name: "JWT Supporter",
      email,
      password: "Password123"
    });
    expect([200, 201]).toContain(signup.status);

    const authUser = await mongoDb.collection("user").findOne({ email });
    expect(authUser?._id).toBeTruthy();

    const profile = await UserProfile.create({
      authUserId: String(authUser?._id),
      name: "JWT Supporter",
      email,
      image: null,
      role: "supporter",
      status: "active",
      onboardingCompleted: true,
      authVersion: 1,
      credits: 50,
      creatorBalance: 0,
      reservedCreatorCredits: 0,
      lifetimeRaisedCredits: 0
    });

    const tokenResponse = await agent.get("/api/auth/token");
    expect(tokenResponse.status).toBe(200);
    expect(tokenResponse.body.token).toEqual(expect.any(String));
    expect(tokenResponse.body.token.split(".")).toHaveLength(3);

    const authorized = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${tokenResponse.body.token}`);

    expect(authorized.status).toBe(200);
    expect(authorized.body.data.profile.id).toBe(profile._id.toString());

    profile.authVersion += 1;
    await profile.save();

    const revoked = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${tokenResponse.body.token}`);

    expect(revoked.status).toBe(401);
    expect(revoked.body.error.code).toBe("ACCESS_TOKEN_REVOKED");
  });

  it("revokes sessions, increments authorization version and records an audit log", async () => {
    const admin = await UserProfile.create({
      authUserId: new ObjectId().toString(),
      name: "Admin User",
      email: "admin@crowdspark.test",
      image: null,
      role: "admin",
      status: "active",
      onboardingCompleted: true,
      authVersion: 1,
      credits: 0,
      creatorBalance: 0,
      reservedCreatorCredits: 0,
      lifetimeRaisedCredits: 0
    });

    const target = await UserProfile.create({
      authUserId: new ObjectId().toString(),
      name: "Target User",
      email: "target@crowdspark.test",
      image: null,
      role: "supporter",
      status: "active",
      onboardingCompleted: true,
      authVersion: 1,
      credits: 50,
      creatorBalance: 0,
      reservedCreatorCredits: 0,
      lifetimeRaisedCredits: 0
    });

    await mongoDb.collection("session").insertOne({
      userId: target.authUserId,
      token: "test-session-token",
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const input = {
      actor: {
        profileId: admin._id,
        authUserId: admin.authUserId,
        name: admin.name,
        ipAddress: "127.0.0.1",
        userAgent: "Vitest"
      },
      idempotencyKey: "status-action-1",
      targetProfileId: target._id.toString(),
      status: "suspended" as const,
      reason: "Repeated policy violations in the test scenario"
    };

    const result = await adminService.updateUserStatusSecure(input);
    expect(result.idempotentRetry).toBe(false);

    const updated = await UserProfile.findById(target._id);
    expect(updated?.status).toBe("suspended");
    expect(updated?.authVersion).toBe(2);
    expect(await mongoDb.collection("session").countDocuments({ userId: target.authUserId })).toBe(
      0
    );
    expect(await AdminAuditLog.countDocuments({ action: "user.status.changed" })).toBe(1);

    const retry = await adminService.updateUserStatusSecure(input);
    expect(retry.idempotentRetry).toBe(true);
    expect(await AdminAuditLog.countDocuments({ action: "user.status.changed" })).toBe(1);
  });

  it("suspends a campaign and records the moderation reason", async () => {
    const admin = await UserProfile.create({
      authUserId: new ObjectId().toString(),
      name: "Admin User",
      email: "admin2@crowdspark.test",
      image: null,
      role: "admin",
      status: "active",
      onboardingCompleted: true,
      authVersion: 1,
      credits: 0,
      creatorBalance: 0,
      reservedCreatorCredits: 0,
      lifetimeRaisedCredits: 0
    });
    const creator = await UserProfile.create({
      authUserId: new ObjectId().toString(),
      name: "Creator User",
      email: "creator@crowdspark.test",
      image: null,
      role: "creator",
      status: "active",
      onboardingCompleted: true,
      authVersion: 1,
      credits: 20,
      creatorBalance: 0,
      reservedCreatorCredits: 0,
      lifetimeRaisedCredits: 0
    });
    const campaign = await Campaign.create({
      creatorId: creator._id,
      creatorName: creator.name,
      creatorEmail: creator.email,
      title: "Campaign requiring moderation",
      story: "A detailed campaign story that is long enough for validation and moderation testing.",
      description: "Campaign used for Admin suspension testing.",
      category: "Community",
      goalCredits: 1000,
      minimumContribution: 10,
      raisedCredits: 0,
      availableBalanceCredits: 0,
      withdrawnCredits: 0,
      deadline: new Date(Date.now() + 86_400_000),
      rewardInfo: "Updates",
      coverImageUrl: "https://example.com/campaign.jpg",
      gallery: [],
      location: "Dhaka",
      status: "approved",
      submittedAt: new Date(),
      reviewedAt: new Date()
    });

    const result = await adminService.reviewCampaignSecure({
      actor: { profileId: admin._id, authUserId: admin.authUserId, name: admin.name },
      idempotencyKey: "campaign-suspend-1",
      campaignId: campaign._id.toString(),
      action: "suspend",
      reason: "Campaign evidence requires an additional compliance review"
    });

    expect(result.campaign?.status).toBe("suspended");
    expect(result.campaign?.moderationReason).toContain("compliance review");
    expect(await AdminAuditLog.countDocuments({ action: "campaign.suspend" })).toBe(1);
  });
});
