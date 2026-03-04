import { NextResponse } from "next/server";
import type { AgeBand, PackId } from "@/lib/types";
import { buildDeck, getDeckSize } from "@/lib/deck";
import { auth } from "@/lib/auth";
import { getUserPacks } from "@/lib/queries/entitlements";

const VALID_BANDS: AgeBand[] = ["6-8", "9-10", "11-12", "13-14"];
const VALID_PACKS: PackId[] = ["sampler", "full"];

/**
 * Serve deck data from the server so that full-deck card content
 * is never shipped in the client JS bundle for unpaid users.
 *
 * Verification priority:
 * 1. Auth.js session → check DB entitlements (persistent, cross-device)
 * 2. x-dd-session header → verify Stripe checkout session (localStorage fallback)
 * 3. No auth → sampler only
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

  let requestedPacks = packsParam.split(",").filter((p): p is PackId =>
    VALID_PACKS.includes(p as PackId),
  );

  if (!requestedPacks.includes("sampler")) {
    requestedPacks.unshift("sampler");
  }

  // Verify entitlements if full pack is requested
  if (requestedPacks.includes("full")) {
    let verified = false;

    // Method 1: Check Auth.js session + DB entitlements
    try {
      const session = await auth();
      if (session?.userId) {
        const dbPacks = await getUserPacks(session.userId);
        if (dbPacks.includes("full")) {
          verified = true;
        }
      }
    } catch {
      // Auth/DB unavailable — try fallback
    }

    // Method 2: Fallback to Stripe session header (for non-authenticated users)
    if (!verified) {
      const authToken = request.headers.get("x-dd-session");
      if (authToken) {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (stripeKey) {
          try {
            const Stripe = (await import("stripe")).default;
            const stripe = new Stripe(stripeKey);
            const stripeSession = await stripe.checkout.sessions.retrieve(authToken);
            if (stripeSession.payment_status === "paid") {
              verified = true;
            }
          } catch {
            // Invalid session
          }
        }
      }
    }

    if (!verified) {
      requestedPacks = requestedPacks.filter((p) => p !== "full");
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
