import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

let replicaSet: MongoMemoryReplSet | undefined;
let UserProfile: typeof import("../../models/UserProfile.js").UserProfile;
let Campaign: typeof import("../../models/Campaign.js").Campaign;
let Withdrawal: typeof import("../../models/Withdrawal.js").Withdrawal;
let WalletTransaction: typeof import("../../models/WalletTransaction.js").WalletTransaction;
let Notification: typeof import("../../models/Notification.js").Notification;
let Payment: typeof import("../../models/Payment.js").Payment;
let ProcessedStripeEvent: typeof import("../../models/ProcessedStripeEvent.js").ProcessedStripeEvent;
let financialService: typeof import("./financial.service.js");

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/crowdspark_test";
  process.env.MONGODB_DB_NAME = "crowdspark_test";
  process.env.CLIENT_URL = "http://localhost:5173";
  process.env.BETTER_AUTH_URL = "http://localhost:5000";
  process.env.BETTER_AUTH_SECRET = "test_secret_that_is_longer_than_thirty_two_characters";
  process.env.WITHDRAWAL_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" }
  });

  await mongoose.connect(replicaSet.getUri(), { dbName: "crowdspark_test" });

  ({ UserProfile } = await import("../../models/UserProfile.js"));
  ({ Campaign } = await import("../../models/Campaign.js"));
  ({ Withdrawal } = await import("../../models/Withdrawal.js"));
  ({ WalletTransaction } = await import("../../models/WalletTransaction.js"));
  ({ Notification } = await import("../../models/Notification.js"));
  ({ Payment } = await import("../../models/Payment.js"));
  ({ ProcessedStripeEvent } = await import("../../models/ProcessedStripeEvent.js"));
  financialService = await import("./financial.service.js");
}, 60_000);

afterEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({}))
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replicaSet) await replicaSet.stop();
}, 60_000);

async function createProfiles() {
  const supporter = await UserProfile.create({
    authUserId: "supporter-auth",
    name: "Supporter Test",
    email: "supporter@test.local",
    role: "supporter",
    status: "active",
    onboardingCompleted: true,
    credits: 500,
    creatorBalance: 0,
    reservedCreatorCredits: 0,
    lifetimeRaisedCredits: 0
  });

  const creator = await UserProfile.create({
    authUserId: "creator-auth",
    name: "Creator Test",
    email: "creator@test.local",
    role: "creator",
    status: "active",
    onboardingCompleted: true,
    credits: 20,
    creatorBalance: 0,
    reservedCreatorCredits: 0,
    lifetimeRaisedCredits: 0
  });

  return { supporter, creator };
}

async function createCampaign(creatorId: mongoose.Types.ObjectId) {
  return Campaign.create({
    creatorId,
    creatorName: "Creator Test",
    creatorEmail: "creator@test.local",
    title: "Transaction-safe campaign",
    story: "A sufficiently detailed campaign story for financial workflow integration testing.",
    description: "A campaign used to verify transaction-safe credit operations.",
    category: "Technology",
    goalCredits: 1000,
    minimumContribution: 10,
    raisedCredits: 0,
    availableBalanceCredits: 0,
    withdrawnCredits: 0,
    deadline: new Date(Date.now() + 86_400_000),
    rewardInfo: "Progress updates",
    coverImageUrl: "https://example.com/campaign.jpg",
    gallery: [],
    location: "Dhaka",
    status: "approved",
    submittedAt: new Date(),
    reviewedAt: new Date()
  });
}

describe("financial transactions", () => {
  it("deducts and approves a contribution atomically", async () => {
    const { supporter, creator } = await createProfiles();
    const campaign = await createCampaign(creator._id);

    const created = await financialService.createContributionTransaction({
      supporterId: supporter._id,
      campaignId: campaign._id.toString(),
      credits: 100,
      message: "Good luck",
      idempotencyKey: "contribution-key-1"
    });

    expect(created.idempotentRetry).toBe(false);
    expect((await UserProfile.findById(supporter._id))?.credits).toBe(400);

    const approved = await financialService.approveContributionTransaction({
      creatorId: creator._id,
      contributionId: created.contribution._id.toString()
    });

    expect(approved.contribution.status).toBe("approved");
    expect((await Campaign.findById(campaign._id))?.raisedCredits).toBe(100);
    expect((await Campaign.findById(campaign._id))?.availableBalanceCredits).toBe(100);
    expect((await UserProfile.findById(creator._id))?.creatorBalance).toBe(100);
    expect(await WalletTransaction.countDocuments()).toBe(2);
    expect(await Notification.countDocuments()).toBe(2);
  });

  it("encrypts withdrawal account information and exposes only the last four characters", async () => {
    const { creator } = await createProfiles();
    creator.creatorBalance = 500;
    await creator.save();

    const campaign = await createCampaign(creator._id);
    campaign.raisedCredits = 500;
    campaign.availableBalanceCredits = 500;
    await campaign.save();

    const result = await financialService.createWithdrawalTransaction({
      creatorId: creator._id,
      credits: 200,
      method: "bkash",
      accountReference: "01700123456",
      idempotencyKey: "withdrawal-key-1"
    });

    const stored = await Withdrawal.findById(result.withdrawal._id).select(
      "+accountReferenceEncrypted"
    );

    expect(stored?.accountReferenceEncrypted).toBeTruthy();
    expect(stored?.accountReferenceEncrypted).not.toContain("01700123456");
    expect(financialService.serializeWithdrawal(result.withdrawal).accountReference).toBe(
      "•••• 3456"
    );
  });

  it("rolls back withdrawal approval when campaign balances are inconsistent", async () => {
    const { creator } = await createProfiles();
    creator.creatorBalance = 500;
    await creator.save();
    await createCampaign(creator._id);

    const created = await financialService.createWithdrawalTransaction({
      creatorId: creator._id,
      credits: 200,
      method: "bank",
      accountReference: "ACCT-987654321",
      idempotencyKey: "withdrawal-key-rollback"
    });

    await expect(
      financialService.approveWithdrawalTransaction({
        withdrawalId: created.withdrawal._id.toString(),
        settlementReference: "SETTLEMENT-001"
      })
    ).rejects.toMatchObject({ code: "CAMPAIGN_BALANCE_MISMATCH" });

    const creatorAfterFailure = await UserProfile.findById(creator._id);
    const withdrawalAfterFailure = await Withdrawal.findById(created.withdrawal._id);

    expect(creatorAfterFailure?.reservedCreatorCredits).toBe(200);
    expect(withdrawalAfterFailure?.status).toBe("pending");
  });

  it("processes a Stripe event only once", async () => {
    const { supporter } = await createProfiles();
    const payment = await Payment.create({
      userId: supporter._id,
      userName: supporter.name,
      userEmail: supporter.email,
      credits: 100,
      amountCents: 1000,
      status: "pending",
      provider: "stripe",
      idempotencyKey: "stripe-payment-1"
    });

    const first = await financialService.completePaymentTransaction(
      payment._id.toString(),
      "pi_test_1",
      { id: "evt_test_1", type: "checkout.session.completed" }
    );
    const second = await financialService.completePaymentTransaction(
      payment._id.toString(),
      "pi_test_1",
      { id: "evt_test_1", type: "checkout.session.completed" }
    );

    expect(first.idempotentRetry).toBe(false);
    expect(second.idempotentRetry).toBe(true);
    expect((await UserProfile.findById(supporter._id))?.credits).toBe(600);
    expect(await ProcessedStripeEvent.countDocuments({ eventId: "evt_test_1" })).toBe(1);
    expect(await WalletTransaction.countDocuments({ type: "credit_purchase" })).toBe(1);
  });

  it("keeps demo credit purchases idempotent", async () => {
    const { supporter } = await createProfiles();
    const input = {
      supporterId: supporter._id,
      credits: 300,
      amountCents: 2500,
      idempotencyKey: "demo-payment-1"
    };

    const first = await financialService.createDemoPaymentTransaction(input);
    const retry = await financialService.createDemoPaymentTransaction(input);

    expect(first.idempotentRetry).toBe(false);
    expect(retry.idempotentRetry).toBe(true);
    expect((await UserProfile.findById(supporter._id))?.credits).toBe(800);
    expect(await Payment.countDocuments({ idempotencyKey: input.idempotencyKey })).toBe(1);
  });
});
