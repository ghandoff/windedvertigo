import { NextResponse } from "next/server";
import { syncVaultActivities } from "@/lib/sync/vault-activities";

/** Allow up to 60s on Hobby, 300s on Pro. */
export const maxDuration = 300;

/**
 * POST /api/cron/sync
 *
 * Called by the Vercel cron (daily at 06:00 UTC) or manually.
 * Protected by CRON_SECRET to prevent public access.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/sync] CRON_SECRET is not set — rejecting request");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error(
      `[cron/sync] auth mismatch: header_len=${authHeader?.length ?? "null"} expected_len=${("Bearer " + cronSecret).length}`,
    );
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  try {
    const t0 = Date.now();
    const count = await syncVaultActivities();
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    console.log(`[cron/sync] vault sync complete: ${count} activities in ${elapsed}s`);
    return NextResponse.json({ ok: true, count, elapsedSeconds: elapsed });
  } catch (err: any) {
    console.error("[cron/sync] vault sync failed:", err);
    return NextResponse.json(
      { ok: false, error: err.message ?? "unknown error" },
      { status: 500 },
    );
  }
}

/**
 * Vercel cron invokes GET by default — redirect to POST handler.
 */
export async function GET(request: Request) {
  return POST(request);
}
