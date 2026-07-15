import type { ClientSession, Types } from "mongoose";
import { WalletTransaction } from "../models/WalletTransaction.js";

export async function recordWalletTransaction(
  input: {
    userId: Types.ObjectId;
    type: string;
    credits: number;
    amountCents?: number;
    direction: "credit" | "debit";
    description: string;
    referenceType?: string | null;
    referenceId?: string | null;
  },
  session?: ClientSession
) {
  const payload = [
    {
      userId: input.userId,
      type: input.type,
      credits: input.credits,
      amountCents: input.amountCents ?? 0,
      direction: input.direction,
      description: input.description,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null
    }
  ];

  const [transaction] = session
    ? await WalletTransaction.create(payload, { session })
    : await WalletTransaction.create(payload);

  if (!transaction) {
    throw new Error("Wallet transaction could not be created");
  }

  return transaction;
}
