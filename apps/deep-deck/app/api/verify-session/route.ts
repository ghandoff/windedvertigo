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

  const { sessionId } = await request.json();
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json(
      { error: "Missing sessionId" },
      { status: 400 },
    );
  }

  try {
    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      return NextResponse.json({ verified: true, pack: "full" });
    }

    return NextResponse.json(
      { verified: false, error: "Payment not completed" },
      { status: 402 },
    );
  } catch {
    return NextResponse.json(
      { verified: false, error: "Invalid session" },
      { status: 400 },
    );
  }
}
