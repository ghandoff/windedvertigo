/**
 * GET /api/cron/sync-rfp-feeds-pilot
 *
 * One-way mirror: Notion rfpFeeds DB → Supabase `rfp_feeds` table.
 * Upserts on notion_page_id (idempotent).
 * This is the Track A Phase 3B Supabase pilot — Notion stays authoritative
 * for writes; Supabase is read-only until the cut-over.
 *
 * Requires env vars:
 *   CRON_SECRET
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllRfpFeedSources } from "@/lib/notion/rfp-feeds";
import { supabase } from "@/lib/supabase/client";

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sources = await getAllRfpFeedSources();

  if (sources.length === 0) {
    return NextResponse.json({ message: "no rfp feed sources found", upserted: 0 });
  }

  const rows = sources.map((s) => ({
    notion_page_id: s.id,
    name: s.name,
    feed_type: s.type ?? null,
    source_label: s.sourceLabel ?? null,
    url: s.url ?? null,
    keywords: s.keywords ?? null,
    notes: s.notes ?? null,
    enabled: s.enabled ?? true,
    last_polled: s.lastPolled ?? null,
    items_last_run: s.itemsLastRun ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("rfp_feeds")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-rfp-feeds-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} rfp feed sources to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}
