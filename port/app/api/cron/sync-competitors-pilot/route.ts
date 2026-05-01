/**
 * GET /api/cron/sync-competitors-pilot
 *
 * One-way mirror: Notion Competitive Landscape DB → Supabase `competitors` table.
 * Runs every 6 hours. Upserts on notion_page_id (idempotent).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllCompetitors } from "@/lib/notion/competitive";
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

  const competitors = await getAllCompetitors();

  if (competitors.length === 0) {
    return NextResponse.json({ message: "no competitors to sync", upserted: 0, total: 0 });
  }

  const rows = competitors.map((c) => ({
    notion_page_id: c.id,
    organisation: c.organisation ?? "",
    type: c.type ?? null,
    threat_level: c.threatLevel ?? null,
    quadrant_overlap: c.quadrantOverlap ?? [],
    geography: c.geography ?? [],
    what_they_offer: c.whatTheyOffer ?? null,
    where_wv_wins: c.whereWvWins ?? null,
    relevance_to_wv: c.relevanceToWv ?? null,
    notes: c.notes ?? null,
    url: c.url ?? null,
    organization_ids: c.organizationIds ?? [],
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("competitors")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-competitors-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} competitors to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}
