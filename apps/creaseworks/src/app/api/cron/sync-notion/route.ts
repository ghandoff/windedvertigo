import { NextResponse } from "next/server";
import { syncAll } from "@/lib/sync";

/** Allow up to 60 s on Hobby, 300 s on Pro. */
export const maxDuration = 300;

/**
 * POST /api/cron/sync-notion
 *
 * Called by the Vercel cron (daily at 06:00 UTC) or manually.
 * Protected by CRON_SECRET to prevent public access.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/sync-notion] CRON_SECRET is not set — rejecting request");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  try {
    const result = await syncAll();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[cron] sync failed:", err);
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
