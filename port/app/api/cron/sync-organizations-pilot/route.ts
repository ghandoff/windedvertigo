/**
 * GET /api/cron/sync-organizations-pilot
 *
 * One-way mirror: Notion organizations DB → Supabase `organizations` table.
 * Runs every 15 minutes. Upserts on notion_page_id (idempotent).
 * `derived_priority` is computed here via computePriority() before upsert.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllOrganizations } from "@/lib/notion/organizations";
import { supabase } from "@/lib/supabase/client";

export const maxDuration = 60;

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await getAllOrganizations();

  if (orgs.length === 0) {
    return NextResponse.json({ message: "no organizations to sync", upserted: 0, total: 0 });
  }

  const rows = orgs.map((o) => ({
    notion_page_id: o.id,
    name: o.organization,
    type: o.type ?? null,
    category: Array.isArray(o.category) ? o.category.join(", ") : (o.category ?? null),
    market_segment: o.marketSegment ?? null,
    website: o.website ?? null,
    email: o.email ?? null,
    connection: o.connection ?? null,
    outreach_status: o.outreachStatus ?? null,
    friendship: o.friendship ?? null,
    fit_rating: o.fitRating ?? null,
    notes: o.notes ?? null,
    derived_priority: o.derivedPriority ?? null,
    // Phase G.1.2: newly synced columns (requires migration 20260502_organizations_add_source_regions_quadrant)
    source: o.source ?? null,
    regions: Array.isArray(o.regions) ? o.regions.join(", ") : null,
    quadrant: o.quadrant ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("organizations")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-organizations-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} organizations to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}
