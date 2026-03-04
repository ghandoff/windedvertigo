import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getUserByEmail } from "@/lib/queries/users";
import { recordPurchase } from "@/lib/queries/entitlements";

/**
 * Stripe webhook handler for checkout.session.completed.
 *
 * This is the canonical source of truth for granting access.
 * Writes to the entitlements table in Neon Postgres when a purchase
 * is confirmed, linked to the user's account via email.
 *
 * To activate:
 * 1. Set STRIPE_WEBHOOK_SECRET in your Vercel env vars
 * 2. In Stripe Dashboard → Developers → Webhooks → Add endpoint
 *    URL: https://windedvertigo.com/reservoir/deep-deck/api/webhook
 *    Events: checkout.session.completed
 */

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  const stripe = new Stripe(stripeKey);
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { error: "Missing signature" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error(`Webhook signature verification failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status === "paid") {
      const email = session.customer_details?.email;
      const userId = session.metadata?.userId;

      console.log(
        `[deep.deck] Purchase confirmed: session=${session.id}, ` +
          `email=${email || "unknown"}, amount=${session.amount_total}`,
      );

      // Find user by metadata userId or by email
      let resolvedUserId = userId;
      if (!resolvedUserId && email) {
        try {
          const user = await getUserByEmail(email);
          if (user) resolvedUserId = user.id;
        } catch {
          console.error("[deep.deck] Failed to look up user by email");
        }
      }

      // Write entitlement to DB if we can identify the user
      if (resolvedUserId) {
        try {
          await recordPurchase({
            userId: resolvedUserId,
            pack: "full",
            amountCents: session.amount_total || 999,
            currency: session.currency || "usd",
            stripeSessionId: session.id,
            stripePaymentIntentId:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : undefined,
          });
          console.log(
            `[deep.deck] Entitlement granted: user=${resolvedUserId}, pack=full`,
          );
        } catch (err) {
          console.error("[deep.deck] Failed to record purchase:", err);
          // Return 500 so Stripe retries
          return NextResponse.json(
            { error: "Failed to process purchase" },
            { status: 500 },
          );
        }
      } else {
        console.warn(
          `[deep.deck] No user found for purchase: session=${session.id}, email=${email}`,
        );
        // Still return 200 — localStorage grant will cover non-authenticated users
      }
    }
  }

  return NextResponse.json({ received: true });
}
