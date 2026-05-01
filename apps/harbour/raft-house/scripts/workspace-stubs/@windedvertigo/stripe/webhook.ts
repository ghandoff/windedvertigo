/**
 * Shared Stripe webhook handler for all harbour apps.
 *
 * Each app creates a thin route handler that calls handleStripeWebhook()
 * with its app name. The shared handler verifies signatures, checks
 * idempotency, creates purchase records, and grants entitlements.
 *
 * Usage:
 * ```ts
 * // apps/deep-deck/app/api/stripe/webhook/route.ts
 * import { handleStripeWebhook } from "@windedvertigo/stripe/webhook";
 *
 * export async function POST(req: Request) {
 *   return handleStripeWebhook(req, "deep-deck");
 * }
 * ```
 */

import { NextResponse } from "next/server";
import { getStripe } from "./client";
import {
  createPurchase,
  getPurchaseByStripeSessionId,
  grantEntitlement,
  grantUserEntitlement,
} from "./queries";
import type Stripe from "stripe";

export async function handleStripeWebhook(
  req: Request,
  app: string,
): Promise<Response> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error(`[${app}] STRIPE_WEBHOOK_SECRET is not set`);
    return NextResponse.json(
      { error: "webhook not configured" },
      { status: 500 },
    );
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "missing stripe-signature header" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error(`[${app}] webhook signature verification failed:`, message);
    return NextResponse.json(
      { error: "invalid signature" },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    try {
      await handleCheckoutCompleted(session, app);
    } catch (err) {
      console.error(`[${app}] webhook handler error:`, err);
      return NextResponse.json(
        { error: "handler failed" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  app: string,
) {
  const sessionId = session.id;
  const metadata = session.metadata || {};

  const orgId = metadata.orgId || null;
  const packCacheId = metadata.packCacheId;
  const catalogueId = metadata.catalogueId;
  const userId = metadata.userId;

  if (!packCacheId || !catalogueId || !userId) {
    console.error(`[${app}] webhook missing metadata:`, {
      orgId,
      packCacheId,
      catalogueId,
      userId,
    });
    return;
  }

  // Idempotency: skip if already processed
  const existing = await getPurchaseByStripeSessionId(sessionId);
  if (existing) {
    console.log(
      `[${app}] webhook: purchase already exists for session ${sessionId}, skipping`,
    );
    return;
  }

  const amountCents = session.amount_total ?? 0;
  const currency = session.currency?.toUpperCase() || "USD";
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  // Create purchase record
  const purchaseId = await createPurchase({
    orgId: orgId || null,
    userId,
    packCatalogueId: catalogueId,
    amountCents,
    currency,
    paymentProvider: "stripe",
    paymentRef: paymentIntentId,
    stripeSessionId: sessionId,
    stripePaymentIntentId: paymentIntentId,
    app,
  });

  // Grant entitlement — org-level if org exists, user-level otherwise
  if (orgId) {
    await grantEntitlement(orgId, packCacheId, purchaseId);
  } else {
    await grantUserEntitlement(userId, packCacheId, purchaseId);
  }

  console.log(
    `[${app}] webhook: purchase ${purchaseId} created, entitlement granted for ${orgId ? `org ${orgId}` : `user ${userId}`} pack ${packCacheId}`,
  );
}
