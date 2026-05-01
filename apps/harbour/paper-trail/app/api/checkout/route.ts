/**
 * API route: /api/checkout
 *
 * POST — create a Stripe Checkout Session for a paper-trail pack purchase.
 * Scaffolded — will be functional once packs are seeded in packs_catalogue.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createHarbourCheckout } from "@windedvertigo/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "you must be signed in to purchase" },
      { status: 401 },
    );
  }

  let body: { packCacheId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { packCacheId } = body;
  if (!packCacheId || typeof packCacheId !== "string") {
    return NextResponse.json(
      { error: "packCacheId is required" },
      { status: 400 },
    );
  }

  try {
    const url = await createHarbourCheckout({
      app: "paper-trail",
      appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://windedvertigo.com/harbour/paper-trail",
      userId: session.user.id ?? "",
      email: session.user.email,
      userName: session.user.name,
      packCacheId,
      catalogueId: packCacheId,
      packTitle: "paper.trail pack",
      priceCents: 0,
      currency: "USD",
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error("stripe checkout error:", err);
    return NextResponse.json(
      { error: "failed to create checkout session" },
      { status: 500 },
    );
  }
}
