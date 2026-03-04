import { NextResponse } from "next/server";
import Stripe from "stripe";

/**
 * Stripe webhook handler for checkout.session.completed.
 *
 * This is the canonical source of truth for granting access.
 * Right now deep.deck uses client-side localStorage, so the webhook
 * serves as a verification backstop and a future integration point
 * for when we add server-side entitlement storage (Auth.js + Neon).
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
      // Log for now — when Auth.js + DB are added, write entitlement here
      console.log(
        `[deep.deck] Purchase confirmed: session=${session.id}, ` +
          `customer=${session.customer_details?.email || "unknown"}, ` +
          `amount=${session.amount_total}`,
      );

      // TODO: Write to entitlements table when DB is added
      // await db.entitlements.upsert({
      //   email: session.customer_details?.email,
      //   pack: "full",
      //   stripeSessionId: session.id,
      //   grantedAt: new Date(),
      // });
    }
  }

  return NextResponse.json({ received: true });
}
