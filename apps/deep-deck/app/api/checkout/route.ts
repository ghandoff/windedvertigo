import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 },
    );
  }

  const stripe = new Stripe(stripeKey);

  const { priceId } = await request.json();
  if (!priceId || typeof priceId !== "string") {
    return NextResponse.json(
      { error: "Missing priceId" },
      { status: 400 },
    );
  }

  const origin = request.headers.get("origin") || "";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/`,
  });

  return NextResponse.json({ url: session.url });
}
