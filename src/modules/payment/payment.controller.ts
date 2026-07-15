import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../../types.js";
import { AppError } from "../../utils/AppError.js";
import { CREDIT_PACKAGES } from "./payment.constant.js";
import {
  completeDemoPayment,
  createStripeCheckout,
  listSupporterPayments,
  processStripeWebhook
} from "./payment.service.js";

function getIdempotencyKey(req: AuthenticatedRequest): string {
  const key = String(req.headers["idempotency-key"] ?? "").trim();
  if (!key) {
    throw new AppError(428, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required");
  }
  return key;
}

export async function webhook(req: Request, res: Response, next: NextFunction) {
  try {
    const signature = req.headers["stripe-signature"];
    if (!signature || Array.isArray(signature)) {
      throw new AppError(400, "STRIPE_SIGNATURE_REQUIRED", "Stripe signature is missing");
    }
    await processStripeWebhook(req.body as Buffer, signature);
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
}

export function packages(_req: Request, res: Response) {
  res.json({ success: true, data: CREDIT_PACKAGES });
}

export async function mine(req: AuthenticatedRequest, res: Response) {
  const result = await listSupporterPayments(
    req.authContext!.profile._id,
    req.query as Record<string, unknown>
  );
  res.json({ success: true, ...result });
}

export async function demo(req: AuthenticatedRequest, res: Response) {
  const result = await completeDemoPayment(
    req.authContext!.profile._id,
    req.body.credits,
    getIdempotencyKey(req)
  );
  res.status(result.idempotentRetry ? 200 : 201).json({
    success: true,
    message: result.idempotentRetry ? "Payment already processed" : "Demo payment completed",
    data: {
      ...result.payment.toObject(),
      id: result.payment._id.toString(),
      idempotentRetry: result.idempotentRetry
    }
  });
}

export async function checkout(req: AuthenticatedRequest, res: Response) {
  const data = await createStripeCheckout(
    req.authContext!.profile,
    req.body.credits,
    getIdempotencyKey(req)
  );
  res.status(201).json({ success: true, data });
}
