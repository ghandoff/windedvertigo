/**
 * GET /api/marketing/social-stats
 *
 * Returns the most recent social-stats snapshot written by the
 * sync-social-stats cron. Internal use only — the strategy page server
 * component reads this. No auth (read-only marketing aggregates), but the
 * page lives behind the dashboard auth wrapper anyway.
 */

import { NextResponse } from "next/server";
import { getSocialStatsFromSnapshot } from "@/lib/marketing/social-stats";

export async function GET() {
  const snapshot = await getSocialStatsFromSnapshot();
  return NextResponse.json({ snapshot });
}
