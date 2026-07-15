import Stripe from "stripe";
import { env } from "../../config/env.js";
import { Payment } from "../../models/Payment.js";
import type { AuthenticatedRequest } from "../../types.js";
import { AppError } from "../../utils/AppError.js";
import { paginationMeta, parsePagination } from "../../utils/pagination.js";
import {
  completePaymentTransaction,
  createDemoPaymentTransaction
} from "../financial/financial.service.js";
import { CREDIT_PACKAGES } from "./payment.constant.js";

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

export function selectCreditPackage(credits: number) {
  const selected = CREDIT_PACKAGES.find((item) => item.credits === credits);
  if (!selected) {
    throw new AppError(422, "INVALID_CREDIT_PACKAGE", "Select a supported credit package");
  }
  return selected;
}

export async function processStripeWebhook(body: Buffer, signature: string) {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError(503, "STRIPE_NOT_CONFIGURED", "Stripe webhook is not configured");
  }

  const event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const paymentId = session.metadata?.paymentId;
    if (paymentId) {
      const intent = typeof session.payment_intent === "string" ? session.payment_intent : null;
      await completePaymentTransaction(paymentId, intent, { id: event.id, type: event.type });
    }
  }
  return event.id;
}

export async function listSupporterPayments(
  supporterId: NonNullable<AuthenticatedRequest["authContext"]>["profile"]["_id"],
  query: Record<string, unknown>
) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { userId: supporterId };
  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Payment.countDocuments(filter)
  ]);
  return {
    data: items.map((item) => ({ ...item, id: item._id.toString() })),
    meta: paginationMeta(page, limit, total)
  };
}

export function completeDemoPayment(
  supporterId: NonNullable<AuthenticatedRequest["authContext"]>["profile"]["_id"],
  credits: number,
  idempotencyKey: string
) {
  if (!env.DEMO_PAYMENTS) {
    throw new AppError(403, "DEMO_PAYMENTS_DISABLED", "Demo payments are disabled");
  }
  const selected = selectCreditPackage(credits);
  return createDemoPaymentTransaction({
    supporterId,
    credits: selected.credits,
    amountCents: selected.amountCents,
    idempotencyKey
  });
}

export async function createStripeCheckout(
  profile: NonNullable<AuthenticatedRequest["authContext"]>["profile"],
  credits: number,
  idempotencyKey: string
) {
  if (!stripe) {
    throw new AppError(
      503,
      "STRIPE_NOT_CONFIGURED",
      "Set STRIPE_SECRET_KEY to enable Stripe checkout"
    );
  }

  const selected = selectCreditPackage(credits);
  let payment = await Payment.findOne({ idempotencyKey, userId: profile._id });
  if (!payment) {
    payment = await Payment.create({
      userId: profile._id,
      userName: profile.name,
      userEmail: profile.email,
      credits: selected.credits,
      amountCents: selected.amountCents,
      status: "pending",
      provider: "stripe",
      idempotencyKey
    });
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: profile.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: selected.amountCents,
            product_data: { name: `${selected.credits} CrowdSpark Credits` }
          },
          quantity: 1
        }
      ],
      success_url: `${env.CLIENT_URL}/dashboard/supporter/payment-history?payment=success`,
      cancel_url: `${env.CLIENT_URL}/dashboard/supporter/purchase-credits?payment=cancelled`,
      metadata: {
        paymentId: payment._id.toString(),
        userId: profile._id.toString(),
        credits: String(selected.credits)
      }
    },
    { idempotencyKey }
  );

  payment.stripeCheckoutSessionId = session.id;
  await payment.save();
  return { checkoutUrl: session.url, paymentId: payment._id.toString() };
}
