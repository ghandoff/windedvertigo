/**
 * POST /api/checkout — create a Stripe checkout session for a raft-house pack.
 *
 * Requires authentication. Uses the shared harbour Stripe package.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createHarbourCheckout, checkEntitlement } from "@windedvertigo/stripe";
import { sql } from "@/lib/db";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://windedvertigo.com/harbour/raft-house";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { packCacheId } = body as { packCacheId?: string };
  if (!packCacheId || typeof packCacheId !== "string") {
    return NextResponse.json(
      { error: "packCacheId is required" },
      { status: 400 },
    );
  }

  // Look up the pack
  const packResult = await sql.query(
    `SELECT
       pc.id AS pack_cache_id,
       pc.title,
       cat.id AS catalogue_id,
       cat.price_cents,
       cat.currency,
       cat.stripe_price_id
     FROM packs_cache pc
     JOIN packs_catalogue cat ON cat.pack_cache_id = pc.id
     WHERE pc.id = $1
       AND cat.app = 'raft-house'
       AND cat.visible = true
     LIMIT 1`,
    [packCacheId],
  );

  const pack = packResult.rows[0];
  if (!pack) {
    return NextResponse.json({ error: "pack not found" }, { status: 404 });
  }

  if (!pack.price_cents || pack.price_cents <= 0) {
    return NextResponse.json(
      { error: "this pack does not have a price set" },
      { status: 400 },
    );
  }

  const alreadyEntitled = await checkEntitlement(
    session.orgId ?? null,
    packCacheId,
    session.userId,
  );
  if (alreadyEntitled) {
    return NextResponse.json(
      { error: "you already have access to this pack" },
      { status: 400 },
    );
  }

  try {
    const url = await createHarbourCheckout({
      app: "raft-house",
      appUrl: APP_URL,
      userId: session.userId,
      email: session.user.email,
      userName: session.user.name,
      orgId: session.orgId,
      orgName: session.orgName,
      packCacheId: pack.pack_cache_id,
      catalogueId: pack.catalogue_id,
      packTitle: pack.title,
      priceCents: pack.price_cents,
      currency: pack.currency || "USD",
      stripePriceId: pack.stripe_price_id ?? undefined,
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[raft-house] checkout error:", err);
    return NextResponse.json(
      { error: "failed to create checkout session" },
      { status: 500 },
    );
  }
}
