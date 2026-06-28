/**
 * Daily knowledge-graph sync — Notion CV (human) + agent logs + curated seed
 * → knowledge_nodes/edges, then reconcile the human↔agent merge bridges.
 *
 * Idempotent: re-running updates rows and bumps last_seen_at; never duplicates.
 * Also the on-demand manual trigger:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://port.windedvertigo.com/api/cron/knowledge-sync
 */

import { NextRequest, NextResponse } from "next/server";
import { runKnowledgeSync } from "@/lib/knowledge/sync";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function verifyAuth(req: NextRequest): boolean {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice(7);
  return (
    (!!process.env.CRON_SECRET && token === process.env.CRON_SECRET) ||
    (!!process.env.CMO_API_TOKEN && token === process.env.CMO_API_TOKEN)
  );
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const report = await runKnowledgeSync();
    return NextResponse.json(report, { status: report.ok ? 200 : 207 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/knowledge-sync] failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
