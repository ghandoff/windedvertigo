/**
 * POST /api/checkout — Create a Stripe checkout session for a vault pack.
 *
 * Requires authentication. Supports both org-level and individual purchases.
 * Expects: { packSlug: "vault-explorer" | "vault-practitioner" }
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { createCheckoutSession } from "@/lib/stripe/checkout";
import { parseJsonBody } from "@/lib/validation";

const VALID_PACK_SLUGS = ["vault-explorer", "vault-practitioner"];

/** Pack pricing — cents */
const PACK_PRICES: Record<string, { cents: number; title: string }> = {
  "vault-explorer": { cents: 999, title: "Vault Explorer Pack" },
  "vault-practitioner": { cents: 1999, title: "Vault Practitioner Pack" },
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { packSlug } = body as { packSlug?: string };

  if (!packSlug || !VALID_PACK_SLUGS.includes(packSlug)) {
    return NextResponse.json(
      { error: "invalid pack slug" },
      { status: 400 },
    );
  }

  // Look up the pack in packs_cache
  const packResult = await sql.query(
    "SELECT id, slug, title FROM packs_cache WHERE slug = $1 LIMIT 1",
    [packSlug],
  );
  const pack = packResult.rows[0];
  if (!pack) {
    return NextResponse.json(
      { error: "pack not found" },
      { status: 404 },
    );
  }

  // Ensure packs_catalogue row exists
  await sql.query(
    `INSERT INTO packs_catalogue (pack_cache_id, visible)
     VALUES ($1, true)
     ON CONFLICT (pack_cache_id) DO NOTHING`,
    [pack.id],
  );

  // Get the catalogue ID
  const catResult = await sql.query(
    "SELECT id FROM packs_catalogue WHERE pack_cache_id = $1 LIMIT 1",
    [pack.id],
  );
  const catalogueId = catResult.rows[0]?.id;
  if (!catalogueId) {
    return NextResponse.json(
      { error: "catalogue entry not found" },
      { status: 500 },
    );
  }

  const pricing = PACK_PRICES[packSlug];

  try {
    const url = await createCheckoutSession({
      orgId: session.orgId ?? null,
      orgName: session.orgName ?? null,
      email: session.user.email,
      userName: session.user.name ?? null,
      packCacheId: pack.id,
      catalogueId,
      packTitle: pricing.title,
      priceCents: pricing.cents,
      currency: "usd",
      userId: session.userId,
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[checkout] failed to create session:", err);
    return NextResponse.json(
      { error: "failed to create checkout session" },
      { status: 500 },
    );
  }
}
