import { NextResponse } from "next/server";
import type { AgeBand, PackId } from "@/lib/types";
import { buildDeck, getDeckSize } from "@/lib/deck";

const VALID_BANDS: AgeBand[] = ["6-8", "9-10", "11-12", "13-14"];
const VALID_PACKS: PackId[] = ["sampler", "full"];

/**
 * Serve deck data from the server so that full-deck card content
 * is never shipped in the client JS bundle for unpaid users.
 *
 * GET /api/deck?band=6-8&packs=sampler,full
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const band = searchParams.get("band") as AgeBand | null;
  const packsParam = searchParams.get("packs") || "sampler";

  if (!band || !VALID_BANDS.includes(band)) {
    return NextResponse.json(
      { error: "Invalid band. Must be one of: 6-8, 9-10, 11-12, 13-14" },
      { status: 400 },
    );
  }

  const requestedPacks = packsParam.split(",").filter((p): p is PackId =>
    VALID_PACKS.includes(p as PackId),
  );

  // Always include sampler
  if (!requestedPacks.includes("sampler")) {
    requestedPacks.unshift("sampler");
  }

  // If requesting full pack, verify entitlement via a simple token check.
  // For now we check the Stripe session stored in the cookie/header.
  // When Auth.js is added, this will check the DB instead.
  if (requestedPacks.includes("full")) {
    const authToken = request.headers.get("x-dd-session");

    if (authToken) {
      // Verify the session is a real paid Stripe session
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (stripeKey) {
        try {
          const Stripe = (await import("stripe")).default;
          const stripe = new Stripe(stripeKey);
          const session = await stripe.checkout.sessions.retrieve(authToken);

          if (session.payment_status !== "paid") {
            // Strip out "full" — only serve sampler cards
            const idx = requestedPacks.indexOf("full");
            if (idx !== -1) requestedPacks.splice(idx, 1);
          }
        } catch {
          // Invalid session — fall back to sampler only
          const idx = requestedPacks.indexOf("full");
          if (idx !== -1) requestedPacks.splice(idx, 1);
        }
      }
    } else {
      // No auth token — sampler only
      const idx = requestedPacks.indexOf("full");
      if (idx !== -1) requestedPacks.splice(idx, 1);
    }
  }

  const deck = buildDeck(band, requestedPacks);
  const totalCards = getDeckSize(band, requestedPacks);

  return NextResponse.json({
    band,
    packs: requestedPacks,
    totalCards,
    deck,
  });
}
