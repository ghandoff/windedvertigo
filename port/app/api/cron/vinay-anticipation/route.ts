/**
 * GET /api/cron/vinay-anticipation — vinay's daily perception sweep + brief
 * (phase 1a, read-only). Triggered by the scheduled self-fetch with
 * `Bearer CRON_SECRET` (see lib/scheduled.ts CRON_TABLE, 12:00 UTC). Runs in
 * request context, so it reads the CF runtime env correctly (immune to #416).
 */

import { NextRequest, NextResponse } from "next/server";
import { runAnticipation } from "@/lib/vinay/anticipation";
import { recordVinayRun } from "@/lib/vinay/runs";

export const maxDuration = 300;

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runAnticipation();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    // fail-loud: record the error heartbeat even when the brief can't be produced
    await recordVinayRun("anticipation", "error", detail.slice(0, 1000)).catch(() => {});
    return NextResponse.json({ ok: false, error: detail }, { status: 500 });
  }
}
