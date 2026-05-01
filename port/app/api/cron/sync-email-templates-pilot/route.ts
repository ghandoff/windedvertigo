/**
 * GET /api/cron/sync-email-templates-pilot
 *
 * One-way mirror: Notion email templates DB → Supabase `email_templates` table.
 * Runs every 15 minutes. Upserts on notion_page_id (idempotent).
 * This is the Track A Phase 3 Supabase pilot — Notion stays authoritative
 * for writes; Supabase is read-only until the cut-over.
 *
 * Requires env vars:
 *   CRON_SECRET
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllEmailTemplates } from "@/lib/notion/email-templates";
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

  const templates = await getAllEmailTemplates();

  if (templates.length === 0) {
    return NextResponse.json({ message: "no email templates found", upserted: 0 });
  }

  const rows = templates.map((t) => ({
    notion_page_id: t.id,
    name: t.name,
    subject: t.subject || null,
    body: t.body || null,
    category: t.category || null,
    channel: t.channel || null,
    notes: t.notes || null,
    times_used: t.timesUsed ?? 0,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("email_templates")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-email-templates-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} email templates to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}
