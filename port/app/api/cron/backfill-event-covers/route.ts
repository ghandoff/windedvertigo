/**
 * GET /api/cron/backfill-event-covers
 *
 * One-shot backfill: fetches cover images for all crm_events rows that have
 * a URL but a NULL cover_image_url. Calls the per-event POST /api/events/{id}/cover
 * endpoint serially (to avoid hammering external sites or hitting CF Browser
 * Rendering limits). Stops after processing `limit` events per run so the
 * cron stays under the 300s Worker CPU budget.
 *
 * Auth: Authorization: Bearer {CRON_SECRET}
 *
 * Query params:
 *   limit   — max events to process per run (default 20, max 50)
 *   dryRun  — if "true", only list events that would be backfilled; do not call cover API
 */

import { NextRequest, NextResponse } from "next/server";
import { getEventsFromSupabase } from "@/lib/supabase/events";

export const maxDuration = 300;

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const dryRun = url.searchParams.get("dryRun") === "true";

  // Fetch events that have a URL but no cover image yet.
  // We use includeNotRelevant to backfill everything.
  const { data: allEvents } = await getEventsFromSupabase(
    { includeNotRelevant: true },
    { pageSize: 500 },
  );

  const needsCover = allEvents
    .filter((e) => e.url && !e.coverImageUrl)
    .slice(0, limit);

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      total: needsCover.length,
      events: needsCover.map((e) => ({ id: e.id, name: e.event, url: e.url })),
    });
  }

  const portUrl = process.env.PORT_URL ?? "https://port.windedvertigo.com";
  const cronSecret = process.env.CRON_SECRET!;

  const results: { id: string; name: string; ok: boolean; error?: string }[] = [];

  for (const evt of needsCover) {
    try {
      const res = await fetch(`${portUrl}/api/events/${evt.id}/cover`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      const body = (await res.json().catch(() => ({}))) as { coverImageUrl?: string; error?: string };
      results.push({
        id: evt.id,
        name: evt.event,
        ok: res.ok,
        ...(body.error ? { error: body.error } : {}),
      });
    } catch (err) {
      results.push({
        id: evt.id,
        name: evt.event,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  console.log(`[backfill-event-covers] processed ${results.length} — ${succeeded} ok, ${failed} failed`);

  return NextResponse.json({
    processed: results.length,
    succeeded,
    failed,
    results,
  });
}
