/**
 * POST /api/gusto/sync — manual trigger (requires auth session)
 * GET  /api/gusto/sync — cron trigger (requires CRON_SECRET bearer token)
 *
 * Both call runGustoSync() and return the SyncResult.
 * GET also posts a summary to Slack.
 *
 * Cron schedule: Monday 1pm UTC / 6am PT (configured in vercel.json).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runGustoSync, type SyncResult } from "@/lib/gusto/sync";
import { postToSlack } from "@/lib/slack";

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

function formatSlackSummary(result: SyncResult): string {
  const parts = [
    `*Gusto Timesheet Sync*`,
    `Synced: ${result.synced} | Skipped: ${result.skipped} | Failed: ${result.failed} | Unmapped: ${result.unmapped}`,
  ];

  if (result.failed > 0) {
    const failures = result.details
      .filter((d) => d.status === "failed")
      .slice(0, 5)
      .map((d) => `  - ${d.entry}: ${d.error}`)
      .join("\n");
    parts.push(`Failures:\n${failures}`);
  }

  if (result.unmapped > 0) {
    const unmapped = result.details
      .filter((d) => d.status === "unmapped")
      .slice(0, 5)
      .map((d) => `  - ${d.entry}: ${d.error}`)
      .join("\n");
    parts.push(`Unmapped:\n${unmapped}`);
  }

  return parts.join("\n");
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runGustoSync();
    await postToSlack(formatSlackSummary(result));

    return NextResponse.json({
      message: `sync complete — ${result.synced} synced, ${result.failed} failed`,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[gusto/sync] cron error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runGustoSync();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[gusto/sync] manual trigger error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
