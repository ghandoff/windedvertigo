/**
 * API route: /api/checkout
 *
 * POST â create a Stripe Checkout Session for a pack purchase.
 *
 * Validates:
 *   - User is authenticated
 *   - User belongs to an organisation
 *   - Pack exists, is visible, and has a price
 *   - Org is not already entitled to this pack
 *
 * Returns { url } for client-side redirect to Stripe.
 *
 * Post-MVP â Stripe integration.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { checkEntitlement } from "@/lib/queries/entitlements";
import { createCheckoutSession } from "@/lib/stripe/checkout";
import { logAccess } from "@/lib/queries/audit";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await requireAuth();

  // Must belong to an org to purchase
  if (!session.orgId || !session.orgName) {
    return NextResponse.json(
      { error: "you need to join an organisation before purchasing" },
      { status: 400 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid request body" },
      { status: 400 },
    );
  }

  const { packCacheId } = body;
  if (!packCacheId || typeof packCacheId !== "string") {
    return NextResponse.json(
      { error: "packCacheId is required" },
      { status: 400 },
    );
  }

  // Look up the pack + catalogue info
  const packResult = await sql.query(
    `SELECT
       pc.id AS pack_cache_id,
       pc.title,
       cat.id AS catalogue_id,
       cat.price_cents,
       cat.currency,
       cat.visible
     FROM packs_cache pc
     JOIN packs_catalogue cat ON cat.pack_cache_id = pc.id
     WHERE pc.id = $1
       AND pc.status = 'ready'
     LIMIT 1`,
    [packCacheId],
  );

  const pack = packResult.rows[0];
  if (!pack) {
    return NextResponse.json(
      { error: "pack not found" },
      { status: 404 },
    );
  }

  if (!pack.visible) {
    return NextResponse.json(
      { error: "this pack is not available for purchase" },
      { status: 400 },
    );
  }

  if (!pack.price_cents || pack.price_cents <= 0) {
    return NextResponse.json(
      { error: "this pack does not have a price set" },
      { status: 400 },
    );
  }

  // Check if org is already entitled
  const alreadyEntitled = await checkEntitlement(session.orgId, packCacheId);
  if (alreadyEntitled) {
    return NextResponse.json(
      { error: "your organisation already has access to this pack" },
      { status: 400 },
    );
  }

  try {
    const url = await createCheckoutSession({
      orgId: session.orgId,
      orgName: session.orgName,
      email: session.email,
      packCacheId: pack.pack_cache_id,
      catalogueId: pack.catalogue_id,
      packTitle: pack.title,
      priceCents: pack.price_cents,
      currency: pack.currency || "USD",
      userId: session.userId,
    });

    // Audit log the checkout initiation (M1: capture IP)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    await logAccess(
      session.userId,
      session.orgId,
      null,
      packCacheId,
      "checkout_initiated",
      ip,
      ["pack_title", "price_cents"],
    );

    return NextResponse.json({ url });
  } catch (err: any) {
    console.error("stripe checkout error:", err);
    return NextResponse.json(
      { error: "failed to create checkout session" },
      { status: 500 },
    );
  }
}
