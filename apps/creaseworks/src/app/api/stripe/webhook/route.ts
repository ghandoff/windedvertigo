/**
 * API route: /api/stripe/webhook
 *
 * POST — handle Stripe webhook events.
 *
 * This endpoint is called by Stripe, not by our app.
 * It verifies the webhook signature, then processes payment events.
 *
 * Handled events:
 *   - checkout.session.completed: create purchase + grant entitlement
 *
 * Must disable Next.js body parsing to access raw body for signature verification.
 *
 * Post-MVP — Stripe integration.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { createPurchase, getPurchaseByStripeSessionId } from "@/lib/queries/purchases";
import { grantEntitlement } from "@/lib/queries/entitlements";
import { logAccess } from "@/lib/queries/audit";
import { sql } from "@/lib/db";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "webhook not configured" },
      { status: 500 },
    );
  }

  // Read raw body for signature verification
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "missing stripe-signature header" },
      { status: 400 },
    );
  }

  // Verify webhook signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: "invalid signature" },
      { status: 400 },
    );
  }

  // Handle the event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    try {
      await handleCheckoutCompleted(session);
    } catch (err: any) {
      console.error("webhook handler error:", err);
      // Return 500 so Stripe retries
      return NextResponse.json(
        { error: "handler failed" },
        { status: 500 },
      );
    }
  }

  // Always return 200 for events we don't handle
  return NextResponse.json({ received: true });
}

/**
 * Handle a completed checkout session.
 *
 * 1. Idempotency check — skip if purchase already exists for this session
 * 2. Look up pack catalogue for the purchase record
 * 3. Create purchase record
 * 4. Grant entitlement to the purchaser's org
 * 5. Audit log
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const sessionId = session.id;
  const metadata = session.metadata || {};

  const orgId = metadata.orgId;
  const packCacheId = metadata.packCacheId;
  const catalogueId = metadata.catalogueId;
  const userId = metadata.userId;

  if (!orgId || !packCacheId || !catalogueId || !userId) {
    console.error("webhook missing metadata:", { orgId, packCacheId, catalogueId, userId });
    return; // can't process without metadata
  }

  // Idempotency: check if we already processed this session
  const existing = await getPurchaseByStripeSessionId(sessionId);
  if (existing) {
    console.log(`webhook: purchase already exists for session ${sessionId}, skipping`);
    return;
  }

  // Get payment details
  const amountCents = session.amount_total ?? 0;
  const currency = session.currency?.toUpperCase() || "USD";
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  // Create purchase record
  const purchaseId = await createPurchase({
    orgId,
    packCatalogueId: catalogueId,
    purchaserId: userId,
    amountCents,
    currency,
    paymentProvider: "stripe",
    paymentRef: paymentIntentId,
    stripeSessionId: sessionId,
    stripePaymentIntentId: paymentIntentId,
  });

  // Grant entitlement with purchase link
  await grantEntitlement(orgId, packCacheId, purchaseId);

  // Audit log — webhook has no client IP, log null
  await logAccess(
    userId,
    orgId,
    null,
    packCacheId,
    "purchase_completed",
    null, // webhook call — no client IP available
    ["stripe_session_id", "amount_cents", "currency"],
  );

  console.log(
    `webhook: purchase ${purchaseId} created, entitlement granted for org ${orgId} pack ${packCacheId}`,
  );
}
