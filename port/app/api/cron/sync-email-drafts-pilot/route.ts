/**
 * GET /api/cron/sync-email-drafts-pilot
 *
 * One-way mirror: Notion email_drafts DB → Supabase `email_drafts` table.
 * Runs every 6 hours via lib/scheduled.ts CRON_TABLE (hours: [1, 7, 13, 19]).
 * Upserts on notion_page_id (idempotent).
 *
 * Requires env vars:
 *   CRON_SECRET
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 *   NOTION_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { queryEmailDrafts } from "@/lib/notion/email-drafts";
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

  // Fetch all drafts from Notion (paginate across all pages)
  const allDrafts: import("@/lib/notion/types").EmailDraft[] = [];
  let cursor: string | undefined;

  do {
    const result = await queryEmailDrafts(
      undefined,
      { cursor, pageSize: 100 },
    );
    allDrafts.push(...result.data);
    cursor = result.nextCursor ?? undefined;
    if (!result.hasMore) break;
  } while (cursor);

  if (allDrafts.length === 0) {
    return NextResponse.json({ message: "no email drafts to sync", upserted: 0, total: 0 });
  }

  const rows = allDrafts.map((d) => ({
    notion_page_id: d.id,
    org_id: d.organizationId || null,
    contact_id: d.contactId ?? null,
    campaign_id: d.campaignId ?? null,
    step_id: d.stepId ?? null,
    subject: d.subject,
    body: d.body,
    status: d.status,
    sent_at: d.sentAt ?? null,
    sent_to: d.sentTo,
    resend_message_id: d.resendMessageId,
    opens: d.opens,
    clicks: d.clicks,
    machine_opens: d.machineOpens,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("email_drafts")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-email-drafts-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} email drafts to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}
