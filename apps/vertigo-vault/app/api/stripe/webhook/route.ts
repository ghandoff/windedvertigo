/**
 * POST /api/stripe/webhook — Handle Stripe webhook events.
 *
 * Processes checkout.session.completed events:
 * 1. Verify webhook signature
 * 2. Check idempotency (no duplicate purchases)
 * 3. Create purchase record
 * 4. Grant entitlement (org-level or user-level)
 */

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { createPurchase, getPurchaseByStripeSessionId } from "@/lib/queries/purchases";
import { grantEntitlement, grantUserEntitlement } from "@/lib/queries/entitlements";

export async function POST(req: Request) {
  const stripe = getStripe();
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "webhook not configured" }, { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[webhook] signature verification failed:", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Idempotency check
    const existing = await getPurchaseByStripeSessionId(session.id);
    if (existing) {
      console.log(`[webhook] duplicate session ${session.id}, skipping`);
      return NextResponse.json({ received: true });
    }

    const { orgId, packCacheId, catalogueId, userId } = session.metadata ?? {};

    if (!packCacheId || !catalogueId || !userId) {
      console.error("[webhook] missing metadata on session:", session.id);
      return NextResponse.json({ error: "missing metadata" }, { status: 400 });
    }

    // Create purchase record
    const purchaseId = await createPurchase({
      orgId: orgId || null,
      packCatalogueId: catalogueId,
      purchaserId: userId,
      amountCents: session.amount_total ?? 0,
      currency: session.currency ?? "usd",
      paymentProvider: "stripe",
      paymentRef: session.payment_intent as string | null,
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent as string | null,
    });

    // Grant entitlement — org-level if orgId present, user-level otherwise
    if (orgId) {
      await grantEntitlement(orgId, packCacheId, purchaseId);
    } else {
      await grantUserEntitlement(userId, packCacheId, null, purchaseId);
    }

    console.log(
      `[webhook] purchase ${purchaseId} for pack ${packCacheId}`,
      orgId ? `(org: ${orgId})` : `(user: ${userId})`,
    );
  }

  return NextResponse.json({ received: true });
}
