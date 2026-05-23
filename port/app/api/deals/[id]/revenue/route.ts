/**
 * PATCH /api/deals/[id]/revenue
 *
 * CMO-facing endpoint for updating a deal's revenue-pipeline position without
 * a code redeploy. Accepts a subset of the revenue-tier fields and writes them
 * directly to Supabase.
 *
 * Called by wv-claw when the CMO (Claude in cowork) updates confidence tier
 * or payment amounts for a deal.
 *
 * Body (all fields optional):
 *   revenue_tier       — "signed" | "advanced" | "negotiation" | "open" | null
 *   received_amount    — cash received to date (number, >= 0)
 *   contracted_amount  — override value for the bar (number | null)
 *
 * [id] is the deal's Notion page id (matches deals.notion_page_id in Supabase).
 */

import { NextResponse } from "next/server";
import { updateDealRevenue } from "@/lib/supabase/deals";
import type { RevenueTier } from "@/lib/notion/types";

const VALID_TIERS = new Set<string>(["signed", "advanced", "negotiation", "open"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "missing deal id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  // Validate and extract allowed fields
  const updates: Parameters<typeof updateDealRevenue>[1] = {};

  if ("revenue_tier" in body) {
    const tier = body.revenue_tier;
    if (tier !== null && (typeof tier !== "string" || !VALID_TIERS.has(tier))) {
      return NextResponse.json(
        { error: `revenue_tier must be one of ${[...VALID_TIERS].join(", ")} or null` },
        { status: 400 },
      );
    }
    updates.revenue_tier = (tier as RevenueTier) ?? null;
  }

  if ("received_amount" in body) {
    const amt = body.received_amount;
    if (typeof amt !== "number" || amt < 0) {
      return NextResponse.json(
        { error: "received_amount must be a non-negative number" },
        { status: 400 },
      );
    }
    updates.received_amount = amt;
  }

  if ("contracted_amount" in body) {
    const amt = body.contracted_amount;
    if (amt !== null && (typeof amt !== "number" || amt < 0)) {
      return NextResponse.json(
        { error: "contracted_amount must be a non-negative number or null" },
        { status: 400 },
      );
    }
    updates.contracted_amount = amt as number | null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no valid fields to update" }, { status: 400 });
  }

  try {
    await updateDealRevenue(id, updates);
    return NextResponse.json({ ok: true, updated: updates });
  } catch (err) {
    console.error("[PATCH /api/deals/[id]/revenue]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "internal error" },
      { status: 500 },
    );
  }
}
