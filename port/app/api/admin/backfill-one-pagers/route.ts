/**
 * POST /api/admin/backfill-one-pagers
 *
 * One-time backfill: generate the R1 one-pager brief for active RFPs that don't
 * have one yet (new ingests get theirs automatically). Idempotent — skips rows
 * that already have `one_pager`. Capped per call so a single request never runs
 * dozens of LLM calls past the Worker limit; call repeatedly until remaining=0.
 *
 * Uses the stored requirements_snapshot as input (the raw TOR body isn't kept
 * after ingest), which yields a slightly thinner brief than a fresh ingest.
 *
 * Auth: CRON_SECRET bearer token (admin-only).
 *
 * Query: ?limit=N (default 15).
 * Returns: { processed: [{rfpId,name}], failed: [...], remaining }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { setRfpOnePager } from "@/lib/supabase/rfp-opportunities";
import { generateOnePager } from "@/lib/ai/rfp-one-pager";

const ACTIVE = ["radar", "reviewing", "pursuing", "interviewing", "submitted"];

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  return (authHeader?.replace("Bearer ", "") ?? "") === process.env.CRON_SECRET;
}

function splitList(v: string | null): string[] {
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

export async function POST(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = Math.min(30, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 15));

  const { data: rows, error } = await supabase
    .from("rfp_opportunities")
    .select("notion_page_id, opportunity_name, requirements_snapshot, decision_notes, geography, service_match, url, rfp_document_url, source")
    .in("status", ACTIVE)
    .is("one_pager", null)
    .limit(limit + 1); // fetch one extra to compute `remaining`

  if (error) {
    return NextResponse.json({ error: "supabase query failed", detail: error.message }, { status: 500 });
  }

  const all = rows ?? [];
  const batch = all.slice(0, limit);
  const remaining = Math.max(0, all.length - batch.length);

  const processed: { rfpId: string; name: string }[] = [];
  const failed: { rfpId: string; name: string; reason: string }[] = [];

  for (const row of batch) {
    const rfpId = row.notion_page_id as string;
    const name = (row.opportunity_name as string) ?? "(unnamed)";
    try {
      const brief = await generateOnePager({
        opportunityName: name,
        requirementsSnapshot: (row.requirements_snapshot as string) ?? undefined,
        decisionNotes: (row.decision_notes as string) ?? undefined,
        torUrl: (row.rfp_document_url as string) || (row.url as string) || undefined,
        source: (row.source as string) ?? undefined,
        geography: splitList(row.geography as string | null),
        serviceMatch: splitList(row.service_match as string | null),
      });
      if (brief) {
        await setRfpOnePager(rfpId, brief.onePager);
        processed.push({ rfpId, name });
      } else {
        failed.push({ rfpId, name, reason: "generator returned null (no input or LLM error)" });
      }
    } catch (err) {
      failed.push({ rfpId, name, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  console.warn(`[admin/backfill-one-pagers] processed ${processed.length}, failed ${failed.length}, remaining ${remaining}`);
  return NextResponse.json({ processed, failed, remaining });
}
