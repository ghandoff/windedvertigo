/**
 * GET /api/cron/sync-campaigns-pilot
 *
 * One-way mirror: Notion campaigns DB → Supabase `campaigns` table.
 * Runs every 15 minutes. Upserts on notion_page_id (idempotent).
 * Track A Phase 4 Supabase pilot — Notion stays authoritative
 * for writes; Supabase is read-only until the cut-over.
 *
 * Requires env vars:
 *   CRON_SECRET
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllCampaigns } from "@/lib/notion/campaigns";
import { supabase } from "@/lib/supabase/client";

export const maxDuration = 60;

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const campaigns = await getAllCampaigns();

  if (campaigns.length === 0) {
    return NextResponse.json({ message: "no campaigns to sync", upserted: 0, total: 0 });
  }

  const rows = campaigns.map((c) => ({
    notion_page_id: c.id,
    name: c.name,
    type: c.type ?? null,
    status: c.status ?? null,
    event_ids: c.eventIds ?? [],
    audience_filters: c.audienceFilters
      ? (c.audienceFilters as unknown as Record<string, unknown>)
      : null,
    owner: c.owner ?? null,
    start_date: c.startDate?.start ?? null,
    end_date: c.endDate?.start ?? null,
    notes: c.notes ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("campaigns")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-campaigns-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} campaigns to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}
