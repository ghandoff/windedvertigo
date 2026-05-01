/**
 * GET /api/cron/ingest-meeting-notes
 *
 * Runs every 4 hours — scans for recently-edited Notion AI Meeting Notes,
 * extracts action items with Claude, and creates work items in the tasks database.
 *
 * Requires env vars:
 *   CRON_SECRET — Vercel cron auth token
 *   NOTION_TOKEN — Notion integration token
 *   MEETING_NOTES_LOOKBACK_HOURS — lookback window (default 6)
 */

import { NextRequest, NextResponse } from "next/server";
import { ingestMeetingNotes } from "@/lib/meeting-ingest/ingest-meeting-notes";

export const maxDuration = 300;

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await ingestMeetingNotes();

    return NextResponse.json({
      message: `ingested ${result.workItemsCreated} work items from ${result.pagesProcessed} meeting pages`,
      ...result,
    });
  } catch (err) {
    console.error("[cron/ingest-meeting-notes] fatal error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    );
  }
}
