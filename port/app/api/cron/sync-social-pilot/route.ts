/**
 * GET /api/cron/sync-social-pilot
 *
 * One-way mirror: Notion social queue DB → Supabase `social_drafts` table.
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
import { getAllSocialDrafts } from "@/lib/notion/social";
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

  const drafts = await getAllSocialDrafts();

  if (drafts.length === 0) {
    return NextResponse.json({ message: "no social drafts found", upserted: 0, total: 0 });
  }

  const rows = drafts.map((s) => ({
    notion_page_id: s.id,
    content: s.content ?? "",
    platform: s.platform ?? null,
    status: s.status ?? null,
    org_id: s.organizationId || null,
    scheduled_for: s.scheduledFor?.start ?? null,
    published_url: null,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("social_drafts")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-social-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} social drafts to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}
