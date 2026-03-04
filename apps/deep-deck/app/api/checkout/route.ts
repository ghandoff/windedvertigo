import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/lib/auth";

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

  // Get authenticated user info if available
  let metadata: Record<string, string> = {};
  let customerEmail: string | undefined;
  try {
    const session = await auth();
    if (session?.userId) {
      metadata.userId = session.userId;
    }
    if (session?.user?.email) {
      customerEmail = session.user.email;
    }
  } catch {
    // Not authenticated — continue without metadata
  }

  const origin = request.headers.get("origin") || "";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/`,
    ...(customerEmail && { customer_email: customerEmail }),
    ...(Object.keys(metadata).length > 0 && { metadata }),
  });

  return NextResponse.json({ url: checkoutSession.url });
}
