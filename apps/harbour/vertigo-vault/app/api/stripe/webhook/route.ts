/**
 * POST /api/stripe/webhook — Handle Stripe webhook events.
 *
 * Processes checkout.session.completed events:
 * 1. Verify webhook signature
 * 2. Confirm payment_status === "paid"
 * 3. Check idempotency (no duplicate purchases)
 * 4. Atomically create purchase record + grant entitlement
 * 5. Send purchase-confirmation email via Resend
 */

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import { createPurchase, getPurchaseByStripeSessionId } from "@/lib/queries/purchases";
import { grantEntitlement, grantUserEntitlement } from "@/lib/queries/entitlements";
import { sendPurchaseConfirmationEmail } from "@/lib/email";

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

    // ── Payment status gate ────────────────────────────────────────
    // For async payment methods (bank transfer, SEPA, etc.) the session
    // completes before the money lands. Only grant access when paid.
    if (session.payment_status !== "paid") {
      console.log(
        `[webhook] session ${session.id} payment_status="${session.payment_status}", deferring`,
      );
      return NextResponse.json({ received: true });
    }

    // Idempotency check
    const existing = await getPurchaseByStripeSessionId(session.id);
    if (existing) {
      console.log(`[webhook] duplicate session ${session.id}, skipping`);
      return NextResponse.json({ received: true });
    }

    const { orgId, packCacheId, catalogueId, userId, packTitle } =
      session.metadata ?? {};

    if (!packCacheId || !catalogueId || !userId) {
      console.error("[webhook] missing metadata on session:", session.id);
      return NextResponse.json({ error: "missing metadata" }, { status: 400 });
    }

    // ── Atomic purchase + entitlement grant ─────────────────────────
    // Acquire a dedicated client so BEGIN/COMMIT/ROLLBACK all run on the
    // same connection. The pool-level sql.query() can dispatch each call
    // to a different connection, breaking transaction isolation.
    const client = await db.connect();
    try {
      await client.query("BEGIN");

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
      }, client);

      // Grant entitlement — org-level if orgId present, user-level otherwise
      if (orgId) {
        await grantEntitlement(orgId, packCacheId, purchaseId, null, client);
      } else {
        await grantUserEntitlement(userId, packCacheId, null, purchaseId, client);
      }

      await client.query("COMMIT");

      console.log(
        `[webhook] purchase ${purchaseId} for pack ${packCacheId}`,
        orgId ? `(org: ${orgId})` : `(user: ${userId})`,
      );

      // ── Confirmation email (fire-and-forget) ───────────────────────
      // Send after the transaction commits so the user gets a receipt.
      // Failures are logged but don't affect the webhook response.
      const customerEmail =
        session.customer_details?.email ?? session.customer_email;

      if (customerEmail) {
        sendPurchaseConfirmationEmail({
          to: customerEmail,
          packName: packTitle || "Vault Pack",
          amountCents: session.amount_total ?? 0,
          currency: session.currency ?? "usd",
        }).catch((err) => {
          console.error("[webhook] email send error:", err);
        });
      }
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[webhook] transaction failed, rolled back:", err);
      return NextResponse.json(
        { error: "purchase processing failed" },
        { status: 500 },
      );
    } finally {
      client.release();
    }
  }

  return NextResponse.json({ received: true });
}
