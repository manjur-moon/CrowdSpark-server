import type { ClientSession, HydratedDocument, Types } from "mongoose";
import { Campaign } from "../../models/Campaign.js";
import { CampaignUpdate } from "../../models/CampaignUpdate.js";
import { Contribution } from "../../models/Contribution.js";
import { Payment, type IPayment } from "../../models/Payment.js";
import { ProcessedStripeEvent } from "../../models/ProcessedStripeEvent.js";
import { UserProfile } from "../../models/UserProfile.js";
import { Withdrawal } from "../../models/Withdrawal.js";
import { createNotification } from "../../services/notification.service.js";
import { recordWalletTransaction } from "../../services/wallet.service.js";
import { AppError } from "../../utils/AppError.js";
import {
  encryptSensitiveValue,
  getLastFourCharacters,
  maskSensitiveReference
} from "../../utils/encryption.js";
import { runInTransaction } from "../../utils/transaction.js";
import type {
  CreateContributionInput,
  CreateWithdrawalInput,
  ReviewContributionInput,
  ReviewWithdrawalInput
} from "./financial.interface.js";

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

export function serializeWithdrawal<
  T extends {
    _id: unknown;
    accountReferenceLast4: string;
    createdAt: Date;
    accountReferenceEncrypted?: string;
  }
>(withdrawal: T) {
  const maybeDocument = withdrawal as T & { toObject?: () => T };
  const source =
    typeof maybeDocument.toObject === "function" ? maybeDocument.toObject() : withdrawal;
  const { accountReferenceEncrypted: _encrypted, ...safe } = source;
  void _encrypted;

  return {
    ...safe,
    id: String(source._id),
    requestedAt: source.createdAt,
    accountReference: maskSensitiveReference(source.accountReferenceLast4)
  };
}

export async function createContributionTransaction(input: CreateContributionInput) {
  try {
    return await runInTransaction(async (session) => {
      const existing = await Contribution.findOne({
        idempotencyKey: input.idempotencyKey,
        supporterId: input.supporterId
      }).session(session);

      if (existing) {
        return { contribution: existing, idempotentRetry: true };
      }

      const campaign = await Campaign.findById(input.campaignId).session(session);
      if (!campaign || campaign.status !== "approved") {
        throw new AppError(
          404,
          "CAMPAIGN_NOT_AVAILABLE",
          "Campaign is not available for contributions"
        );
      }
      if (campaign.deadline.getTime() <= Date.now()) {
        throw new AppError(409, "CAMPAIGN_CLOSED", "Campaign deadline has passed");
      }
      if (input.credits < campaign.minimumContribution) {
        throw new AppError(
          422,
          "MINIMUM_CONTRIBUTION",
          `Minimum contribution is ${campaign.minimumContribution} credits`
        );
      }

      const supporter = await UserProfile.findOneAndUpdate(
        { _id: input.supporterId, credits: { $gte: input.credits } },
        { $inc: { credits: -input.credits } },
        { new: true, session }
      );
      if (!supporter) {
        throw new AppError(409, "INSUFFICIENT_CREDITS", "You do not have enough credits");
      }

      const [contribution] = await Contribution.create(
        [
          {
            campaignId: campaign._id,
            campaignTitle: campaign.title,
            supporterId: supporter._id,
            supporterName: supporter.name,
            supporterEmail: supporter.email,
            creatorId: campaign.creatorId,
            creatorName: campaign.creatorName,
            creatorEmail: campaign.creatorEmail,
            credits: input.credits,
            message: input.message ?? null,
            status: "pending",
            idempotencyKey: input.idempotencyKey
          }
        ],
        { session }
      );
      if (!contribution) {
        throw new Error("Contribution could not be created");
      }

      await recordWalletTransaction(
        {
          userId: supporter._id,
          type: "contribution_pending",
          credits: input.credits,
          direction: "debit",
          description: `Contribution to ${campaign.title}`,
          referenceType: "contribution",
          referenceId: contribution._id.toString()
        },
        session
      );

      await createNotification(
        {
          userId: campaign.creatorId,
          type: "contribution_received",
          title: "New contribution",
          message: `${supporter.name} contributed ${input.credits} credits to ${campaign.title}`,
          actionUrl: "/dashboard/creator/contributions",
          metadata: {
            contributionId: contribution._id.toString(),
            campaignId: campaign._id.toString()
          }
        },
        session
      );

      return { contribution, idempotentRetry: false };
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const existing = await Contribution.findOne({
        idempotencyKey: input.idempotencyKey,
        supporterId: input.supporterId
      });
      if (existing) return { contribution: existing, idempotentRetry: true };
    }
    throw error;
  }
}

export async function approveContributionTransaction(input: ReviewContributionInput) {
  return runInTransaction(async (session) => {
    const contribution = await Contribution.findOne({
      _id: input.contributionId,
      creatorId: input.creatorId
    }).session(session);

    if (!contribution) {
      throw new AppError(404, "CONTRIBUTION_NOT_FOUND", "Contribution not found");
    }
    if (contribution.status === "approved") {
      return { contribution, idempotentRetry: true };
    }
    if (contribution.status !== "pending") {
      throw new AppError(
        409,
        "CONTRIBUTION_ALREADY_REVIEWED",
        "Only pending contributions can be approved"
      );
    }

    const campaign = await Campaign.findOneAndUpdate(
      { _id: contribution.campaignId, creatorId: input.creatorId, status: "approved" },
      {
        $inc: {
          raisedCredits: contribution.credits,
          availableBalanceCredits: contribution.credits
        }
      },
      { new: true, session }
    );
    if (!campaign) {
      throw new AppError(409, "CAMPAIGN_NOT_APPROVED", "Campaign is not approved");
    }

    const creator = await UserProfile.findOneAndUpdate(
      { _id: input.creatorId, status: "active" },
      {
        $inc: {
          creatorBalance: contribution.credits,
          lifetimeRaisedCredits: contribution.credits
        }
      },
      { new: true, session }
    );
    if (!creator) {
      throw new AppError(404, "CREATOR_NOT_FOUND", "Creator account not found");
    }

    contribution.status = "approved";
    contribution.reviewedAt = new Date();
    contribution.reviewNote = input.reviewNote ?? null;
    await contribution.save({ session });

    await recordWalletTransaction(
      {
        userId: creator._id,
        type: "contribution_approved",
        credits: contribution.credits,
        direction: "credit",
        description: `Approved contribution for ${contribution.campaignTitle}`,
        referenceType: "contribution",
        referenceId: contribution._id.toString()
      },
      session
    );

    await createNotification(
      {
        userId: contribution.supporterId,
        type: "contribution_approved",
        title: "Contribution approved",
        message: `Your ${contribution.credits}-credit contribution to ${contribution.campaignTitle} was approved`,
        actionUrl: `/dashboard/supporter/contributions/${contribution._id.toString()}`,
        metadata: { contributionId: contribution._id.toString() }
      },
      session
    );

    return { contribution, idempotentRetry: false };
  });
}

export async function rejectContributionTransaction(input: ReviewContributionInput) {
  return runInTransaction(async (session) => {
    const contribution = await Contribution.findOne({
      _id: input.contributionId,
      creatorId: input.creatorId
    }).session(session);

    if (!contribution) {
      throw new AppError(404, "CONTRIBUTION_NOT_FOUND", "Contribution not found");
    }
    if (contribution.status === "rejected") {
      return { contribution, idempotentRetry: true };
    }
    if (contribution.status !== "pending") {
      throw new AppError(
        409,
        "CONTRIBUTION_ALREADY_REVIEWED",
        "Only pending contributions can be rejected"
      );
    }

    const supporter = await UserProfile.findOneAndUpdate(
      { _id: contribution.supporterId },
      { $inc: { credits: contribution.credits } },
      { new: true, session }
    );
    if (!supporter) {
      throw new AppError(404, "SUPPORTER_NOT_FOUND", "Supporter account not found");
    }

    contribution.status = "rejected";
    contribution.reviewNote = input.reviewNote ?? null;
    contribution.reviewedAt = new Date();
    await contribution.save({ session });

    await recordWalletTransaction(
      {
        userId: supporter._id,
        type: "contribution_rejected",
        credits: contribution.credits,
        direction: "credit",
        description: `Refund for rejected contribution to ${contribution.campaignTitle}`,
        referenceType: "contribution",
        referenceId: contribution._id.toString()
      },
      session
    );

    await createNotification(
      {
        userId: supporter._id,
        type: "contribution_rejected",
        title: "Contribution rejected",
        message: `Your contribution to ${contribution.campaignTitle} was rejected and credits were returned`,
        actionUrl: `/dashboard/supporter/contributions/${contribution._id.toString()}`,
        metadata: { contributionId: contribution._id.toString() }
      },
      session
    );

    return { contribution, idempotentRetry: false };
  });
}

async function debitCampaignBalances(
  creatorId: Types.ObjectId,
  credits: number,
  session: ClientSession
): Promise<void> {
  const campaigns = await Campaign.find({
    creatorId,
    availableBalanceCredits: { $gt: 0 }
  })
    .sort({ createdAt: 1 })
    .session(session);

  const availableTotal = campaigns.reduce(
    (sum, campaign) => sum + campaign.availableBalanceCredits,
    0
  );
  if (availableTotal < credits) {
    throw new AppError(
      409,
      "CAMPAIGN_BALANCE_MISMATCH",
      "Campaign balances are insufficient for this withdrawal"
    );
  }

  let remaining = credits;
  for (const campaign of campaigns) {
    if (remaining <= 0) break;
    const debit = Math.min(remaining, campaign.availableBalanceCredits);
    campaign.availableBalanceCredits -= debit;
    campaign.withdrawnCredits += debit;
    await campaign.save({ session });
    remaining -= debit;
  }
}

export async function createWithdrawalTransaction(input: CreateWithdrawalInput) {
  try {
    return await runInTransaction(async (session) => {
      const existing = await Withdrawal.findOne({
        idempotencyKey: input.idempotencyKey,
        creatorId: input.creatorId
      }).session(session);
      if (existing) return { withdrawal: existing, idempotentRetry: true };

      const creator = await UserProfile.findOneAndUpdate(
        {
          _id: input.creatorId,
          role: "creator",
          status: "active",
          creatorBalance: { $gte: input.credits }
        },
        {
          $inc: {
            creatorBalance: -input.credits,
            reservedCreatorCredits: input.credits
          }
        },
        { new: true, session }
      );
      if (!creator) {
        throw new AppError(
          409,
          "INSUFFICIENT_CREATOR_BALANCE",
          "Insufficient withdrawable credits"
        );
      }

      const [withdrawal] = await Withdrawal.create(
        [
          {
            creatorId: creator._id,
            creatorName: creator.name,
            creatorEmail: creator.email,
            credits: input.credits,
            amountCents: input.credits * 5,
            method: input.method,
            accountReferenceEncrypted: encryptSensitiveValue(input.accountReference),
            accountReferenceLast4: getLastFourCharacters(input.accountReference),
            status: "pending",
            idempotencyKey: input.idempotencyKey
          }
        ],
        { session }
      );
      if (!withdrawal) throw new Error("Withdrawal could not be created");

      await recordWalletTransaction(
        {
          userId: creator._id,
          type: "withdrawal_reserved",
          credits: input.credits,
          amountCents: input.credits * 5,
          direction: "debit",
          description: "Credits reserved for a withdrawal request",
          referenceType: "withdrawal",
          referenceId: withdrawal._id.toString()
        },
        session
      );

      return { withdrawal, idempotentRetry: false };
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const existing = await Withdrawal.findOne({
        idempotencyKey: input.idempotencyKey,
        creatorId: input.creatorId
      });
      if (existing) return { withdrawal: existing, idempotentRetry: true };
    }
    throw error;
  }
}

export async function approveWithdrawalTransaction(input: ReviewWithdrawalInput) {
  return runInTransaction(async (session) => {
    const withdrawal = await Withdrawal.findById(input.withdrawalId).session(session);
    if (!withdrawal) {
      throw new AppError(404, "WITHDRAWAL_NOT_FOUND", "Withdrawal not found");
    }
    if (withdrawal.status === "approved") {
      return { withdrawal, idempotentRetry: true };
    }
    if (withdrawal.status !== "pending") {
      throw new AppError(
        409,
        "WITHDRAWAL_ALREADY_REVIEWED",
        "Withdrawal has already been reviewed"
      );
    }
    if (!input.settlementReference) {
      throw new AppError(422, "SETTLEMENT_REFERENCE_REQUIRED", "Settlement reference is required");
    }

    const creator = await UserProfile.findOneAndUpdate(
      {
        _id: withdrawal.creatorId,
        reservedCreatorCredits: { $gte: withdrawal.credits }
      },
      { $inc: { reservedCreatorCredits: -withdrawal.credits } },
      { new: true, session }
    );
    if (!creator) {
      throw new AppError(
        409,
        "RESERVED_BALANCE_MISMATCH",
        "Reserved Creator balance is inconsistent"
      );
    }

    await debitCampaignBalances(withdrawal.creatorId, withdrawal.credits, session);

    withdrawal.status = "approved";
    withdrawal.reviewedAt = new Date();
    withdrawal.reviewNote = input.reviewNote ?? null;
    withdrawal.settlementReference = input.settlementReference;
    await withdrawal.save({ session });

    await recordWalletTransaction(
      {
        userId: withdrawal.creatorId,
        type: "withdrawal_settled",
        credits: 0,
        amountCents: withdrawal.amountCents,
        direction: "debit",
        description: "Creator withdrawal settled",
        referenceType: "withdrawal",
        referenceId: withdrawal._id.toString()
      },
      session
    );

    await createNotification(
      {
        userId: withdrawal.creatorId,
        type: "withdrawal_approved",
        title: "Withdrawal approved",
        message: `Your ${withdrawal.credits}-credit withdrawal was approved`,
        actionUrl: "/dashboard/creator/withdrawals",
        metadata: { withdrawalId: withdrawal._id.toString() }
      },
      session
    );

    return { withdrawal, idempotentRetry: false };
  });
}

export async function rejectWithdrawalTransaction(input: ReviewWithdrawalInput) {
  return runInTransaction(async (session) => {
    const withdrawal = await Withdrawal.findById(input.withdrawalId).session(session);
    if (!withdrawal) {
      throw new AppError(404, "WITHDRAWAL_NOT_FOUND", "Withdrawal not found");
    }
    if (withdrawal.status === "rejected") {
      return { withdrawal, idempotentRetry: true };
    }
    if (withdrawal.status !== "pending") {
      throw new AppError(
        409,
        "WITHDRAWAL_ALREADY_REVIEWED",
        "Withdrawal has already been reviewed"
      );
    }

    const creator = await UserProfile.findOneAndUpdate(
      {
        _id: withdrawal.creatorId,
        reservedCreatorCredits: { $gte: withdrawal.credits }
      },
      {
        $inc: {
          creatorBalance: withdrawal.credits,
          reservedCreatorCredits: -withdrawal.credits
        }
      },
      { new: true, session }
    );
    if (!creator) {
      throw new AppError(
        409,
        "RESERVED_BALANCE_MISMATCH",
        "Reserved Creator balance is inconsistent"
      );
    }

    withdrawal.status = "rejected";
    withdrawal.reviewedAt = new Date();
    withdrawal.reviewNote = input.reviewNote ?? null;
    await withdrawal.save({ session });

    await recordWalletTransaction(
      {
        userId: creator._id,
        type: "withdrawal_rejected",
        credits: withdrawal.credits,
        amountCents: withdrawal.amountCents,
        direction: "credit",
        description: "Rejected withdrawal credits restored",
        referenceType: "withdrawal",
        referenceId: withdrawal._id.toString()
      },
      session
    );

    await createNotification(
      {
        userId: creator._id,
        type: "withdrawal_rejected",
        title: "Withdrawal rejected",
        message: `Withdrawal rejected: ${input.reviewNote ?? "Please review your payout details"}. Credits were restored.`,
        actionUrl: "/dashboard/creator/withdrawals",
        metadata: { withdrawalId: withdrawal._id.toString() }
      },
      session
    );

    return { withdrawal, idempotentRetry: false };
  });
}

export async function completePaymentTransaction(
  paymentId: string,
  paymentIntentId?: string | null,
  stripeEvent?: { id: string; type: string }
): Promise<{ payment: HydratedDocument<IPayment> | null; idempotentRetry: boolean }> {
  try {
    return await runInTransaction(async (session) => {
      if (stripeEvent) {
        const alreadyProcessed = await ProcessedStripeEvent.exists({
          eventId: stripeEvent.id
        }).session(session);
        if (alreadyProcessed) return { payment: null, idempotentRetry: true };

        await ProcessedStripeEvent.create(
          [{ eventId: stripeEvent.id, eventType: stripeEvent.type }],
          { session }
        );
      }

      const payment = await Payment.findById(paymentId).session(session);
      if (!payment) {
        throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment record not found");
      }
      if (payment.status === "succeeded") {
        return { payment, idempotentRetry: true };
      }

      const supporter = await UserProfile.findOneAndUpdate(
        { _id: payment.userId, role: "supporter", status: "active" },
        { $inc: { credits: payment.credits } },
        { new: true, session }
      );
      if (!supporter) {
        throw new AppError(404, "SUPPORTER_NOT_FOUND", "Supporter account not found");
      }

      payment.status = "succeeded";
      payment.stripePaymentIntentId = paymentIntentId ?? null;
      await payment.save({ session });

      await recordWalletTransaction(
        {
          userId: supporter._id,
          type: "credit_purchase",
          credits: payment.credits,
          amountCents: payment.amountCents,
          direction: "credit",
          description: `Purchased ${payment.credits} CrowdSpark credits`,
          referenceType: "payment",
          referenceId: payment._id.toString()
        },
        session
      );

      await createNotification(
        {
          userId: supporter._id,
          type: "payment_succeeded",
          title: "Credits added",
          message: `${payment.credits} credits were added to your wallet`,
          actionUrl: "/dashboard/supporter/payment-history",
          metadata: { paymentId: payment._id.toString() }
        },
        session
      );

      return { payment, idempotentRetry: false };
    });
  } catch (error) {
    if (stripeEvent && isDuplicateKeyError(error)) {
      return { payment: null, idempotentRetry: true };
    }
    throw error;
  }
}

export async function createDemoPaymentTransaction(input: {
  supporterId: Types.ObjectId;
  credits: number;
  amountCents: number;
  idempotencyKey: string;
}) {
  try {
    return await runInTransaction(async (session) => {
      const existing = await Payment.findOne({
        idempotencyKey: input.idempotencyKey,
        userId: input.supporterId
      }).session(session);
      if (existing) return { payment: existing, idempotentRetry: true };

      const supporter = await UserProfile.findOne({
        _id: input.supporterId,
        role: "supporter",
        status: "active"
      }).session(session);
      if (!supporter) {
        throw new AppError(404, "SUPPORTER_NOT_FOUND", "Supporter account not found");
      }

      const [payment] = await Payment.create(
        [
          {
            userId: supporter._id,
            userName: supporter.name,
            userEmail: supporter.email,
            credits: input.credits,
            amountCents: input.amountCents,
            status: "pending",
            provider: "demo",
            idempotencyKey: input.idempotencyKey
          }
        ],
        { session }
      );
      if (!payment) throw new Error("Payment could not be created");

      supporter.credits += input.credits;
      await supporter.save({ session });
      payment.status = "succeeded";
      await payment.save({ session });

      await recordWalletTransaction(
        {
          userId: supporter._id,
          type: "credit_purchase",
          credits: input.credits,
          amountCents: input.amountCents,
          direction: "credit",
          description: `Demo purchase of ${input.credits} credits`,
          referenceType: "payment",
          referenceId: payment._id.toString()
        },
        session
      );

      await createNotification(
        {
          userId: supporter._id,
          type: "payment_succeeded",
          title: "Demo payment complete",
          message: `${input.credits} credits were added to your wallet`,
          actionUrl: "/dashboard/supporter/payment-history",
          metadata: { paymentId: payment._id.toString() }
        },
        session
      );

      return { payment, idempotentRetry: false };
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const existing = await Payment.findOne({
        idempotencyKey: input.idempotencyKey,
        userId: input.supporterId
      });
      if (existing) return { payment: existing, idempotentRetry: true };
    }
    throw error;
  }
}

export async function deleteCreatorCampaignTransaction(input: {
  campaignId: string;
  creatorId: Types.ObjectId;
}) {
  return runInTransaction(async (session) => {
    const campaign = await Campaign.findOne({
      _id: input.campaignId,
      creatorId: input.creatorId
    }).session(session);
    if (!campaign) {
      throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");
    }

    if (campaign.withdrawnCredits > 0) {
      const pendingContributions = await Contribution.find({
        campaignId: campaign._id,
        status: "pending"
      }).session(session);

      let refundedCredits = 0;
      for (const contribution of pendingContributions) {
        const supporter = await UserProfile.findOneAndUpdate(
          { _id: contribution.supporterId },
          { $inc: { credits: contribution.credits } },
          { new: true, session }
        );
        if (!supporter) {
          throw new AppError(404, "SUPPORTER_NOT_FOUND", "Supporter account not found");
        }

        contribution.status = "rejected";
        contribution.reviewedAt = new Date();
        contribution.reviewNote =
          "Campaign archived because previously raised funds were already withdrawn";
        await contribution.save({ session });

        refundedCredits += contribution.credits;

        await recordWalletTransaction(
          {
            userId: supporter._id,
            type: "campaign_archived_refund",
            credits: contribution.credits,
            direction: "credit",
            description: `Refund after archival of ${campaign.title}`,
            referenceType: "campaign",
            referenceId: campaign._id.toString()
          },
          session
        );

        await createNotification(
          {
            userId: supporter._id,
            type: "contribution_rejected",
            title: "Pending contribution refunded",
            message: `${contribution.credits} credits were returned because ${campaign.title} was archived`,
            actionUrl: "/dashboard/supporter/contributions",
            metadata: {
              campaignId: campaign._id.toString(),
              contributionId: contribution._id.toString()
            }
          },
          session
        );
      }

      campaign.status = "archived";
      await campaign.save({ session });
      return { deleted: false, archived: true, refundedCredits };
    }

    const refundableContributions = await Contribution.find({
      campaignId: campaign._id,
      status: { $in: ["pending", "approved", "refund_requested"] }
    }).session(session);

    const approvedRefundTotal = refundableContributions
      .filter((item) => item.status !== "pending")
      .reduce((sum, item) => sum + item.credits, 0);

    if (approvedRefundTotal > 0) {
      const creator = await UserProfile.findOneAndUpdate(
        {
          _id: campaign.creatorId,
          creatorBalance: { $gte: approvedRefundTotal }
        },
        { $inc: { creatorBalance: -approvedRefundTotal } },
        { new: true, session }
      );
      if (!creator) {
        throw new AppError(
          409,
          "CAMPAIGN_REFUND_BALANCE_UNAVAILABLE",
          "Campaign cannot be deleted while its refundable balance is reserved or unavailable"
        );
      }

      if (campaign.availableBalanceCredits < approvedRefundTotal) {
        throw new AppError(
          409,
          "CAMPAIGN_BALANCE_MISMATCH",
          "Campaign available balance is inconsistent"
        );
      }

      await recordWalletTransaction(
        {
          userId: creator._id,
          type: "campaign_refund_debit",
          credits: approvedRefundTotal,
          direction: "debit",
          description: `Campaign deletion refunds for ${campaign.title}`,
          referenceType: "campaign",
          referenceId: campaign._id.toString()
        },
        session
      );
    }

    let refundedCredits = 0;
    for (const contribution of refundableContributions) {
      const supporter = await UserProfile.findOneAndUpdate(
        { _id: contribution.supporterId },
        { $inc: { credits: contribution.credits } },
        { new: true, session }
      );
      if (!supporter) {
        throw new AppError(404, "SUPPORTER_NOT_FOUND", "Supporter account not found");
      }

      contribution.status = "refunded";
      contribution.refundedAt = new Date();
      contribution.reviewNote = "Campaign deleted by Creator; credits refunded automatically";
      await contribution.save({ session });

      refundedCredits += contribution.credits;

      await recordWalletTransaction(
        {
          userId: supporter._id,
          type: "campaign_deleted_refund",
          credits: contribution.credits,
          direction: "credit",
          description: `Refund after deletion of ${campaign.title}`,
          referenceType: "campaign",
          referenceId: campaign._id.toString()
        },
        session
      );

      await createNotification(
        {
          userId: supporter._id,
          type: "contribution_refunded",
          title: "Campaign contribution refunded",
          message: `${contribution.credits} credits were returned because ${campaign.title} was deleted`,
          actionUrl: "/dashboard/supporter/contributions",
          metadata: {
            campaignId: campaign._id.toString(),
            contributionId: contribution._id.toString()
          }
        },
        session
      );
    }

    await CampaignUpdate.deleteMany({ campaignId: campaign._id }).session(session);
    await campaign.deleteOne({ session });

    return { deleted: true, archived: false, refundedCredits };
  });
}
