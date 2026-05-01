/**
 * GET /api/cron/sync-campaign-steps-pilot
 *
 * One-way mirror: Notion campaign_steps DB → Supabase `campaign_steps` table.
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
import { getAllCampaignSteps } from "@/lib/notion/campaign-steps";
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

  const steps = await getAllCampaignSteps();

  if (steps.length === 0) {
    return NextResponse.json({ message: "no campaign steps to sync", upserted: 0, total: 0 });
  }

  const rows = steps.map((s) => ({
    notion_page_id: s.id,
    name: s.name,
    campaign_ids: s.campaignIds ?? [],
    step_number: s.stepNumber ?? null,
    channel: s.channel ?? null,
    subject: s.subject ?? null,
    body: s.body ?? null,
    delay_days: s.delayDays ?? null,
    send_date: s.sendDate?.start ?? null,
    status: s.status ?? null,
    sent_count: s.sentCount ?? null,
    skipped_count: s.skippedCount ?? null,
    failed_count: s.failedCount ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("campaign_steps")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-campaign-steps-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} campaign steps to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}
