/**
 * GET /api/cron/sync-rfp-pilot
 *
 * One-way mirror: Notion rfp_radar DB → Supabase `rfp_opportunities` table.
 * Runs every 15 minutes. Upserts on notion_page_id (idempotent).
 * This is the Track A Phase E3 Supabase pilot — Notion stays authoritative
 * for writes; Supabase is read-only until the cut-over.
 *
 * Requires env vars:
 *   CRON_SECRET
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllRfpOpportunities } from "@/lib/notion/rfp-radar";
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

  const opportunities = await getAllRfpOpportunities();

  if (opportunities.length === 0) {
    return NextResponse.json({ message: "no rfp opportunities found", upserted: 0 });
  }

  const rawRows = opportunities.map((r) => ({
    notion_page_id: r.id,
    opportunity_name: r.opportunityName ?? "",
    status: r.status ?? null,
    opportunity_type: r.opportunityType ?? null,
    organization_ids: r.organizationIds ?? [],
    related_project_ids: r.relatedProjectIds ?? [],
    owner_ids: r.ownerIds ?? [],
    estimated_value: r.estimatedValue ?? null,
    due_date: r.dueDate?.start ?? null,
    wv_fit_score: r.wvFitScore ?? null,
    service_match: Array.isArray(r.serviceMatch)
      ? r.serviceMatch.join(",")
      : (r.serviceMatch ?? null),
    category: Array.isArray(r.category)
      ? r.category.join(",")
      : (r.category ?? null),
    geography: Array.isArray(r.geography)
      ? r.geography.join(",")
      : (r.geography ?? null),
    source: r.source ?? null,
    proposal_status: r.proposalStatus ?? null,
    requirements_snapshot: r.requirementsSnapshot ?? null,
    decision_notes: r.decisionNotes ?? null,
    url: r.url || null,
    rfp_document_url: r.rfpDocumentUrl ?? null,
    proposal_draft_url: r.proposalDraftUrl ?? null,
    question_bank_url: r.questionBankUrl ?? null,
    question_count: r.questionCount ?? null,
    cover_letter_url: r.coverLetterUrl ?? null,
    team_cvs_url: r.teamCvsUrl ?? null,
    what_worked: r.whatWorked || null,
    what_fell_flat: r.whatFellFlat || null,
    client_feedback: r.clientFeedback || null,
    lessons_for_next_time: r.lessonsForNextTime || null,
    proposal_notes: r.proposalNotes || null,
    created_time: r.createdTime || null,
    last_edited_time: r.lastEditedTime || null,
    // deadline_timezone intentionally excluded — managed by rfp-triage,
    // never overwrite a value that triage already set
    updated_at: new Date().toISOString(),
  }));

  // ── status guard ─────────────────────────────────────────────────────────
  // This is the fix for the "cards revert to radar" bug.
  //
  // The upsert overwrites ALL columns, including `status`, with whatever Notion
  // currently says.  If the Notion write in transitionRfpStatus() was slow or
  // failed transiently, Notion still shows "radar" while Supabase already has
  // the correct non-radar status from the immediate setRfpStatus() call.  Without
  // this guard the sync would revert the card on every 15-minute tick.
  //
  // Fix: fetch all existing Supabase statuses in ONE bulk SELECT, then for any
  // row where Notion says null/radar but Supabase already has a non-radar status,
  // keep the Supabase status.  All other transitions (Notion non-radar → anything)
  // pass through unchanged so legitimate Notion-side edits still win.
  const notionIds = rawRows.map((r) => r.notion_page_id);
  const { data: existingRows } = await supabase
    .from("rfp_opportunities")
    .select("notion_page_id, status")
    .in("notion_page_id", notionIds);

  const existingStatusMap = new Map<string, string | null>(
    (existingRows ?? []).map((r) => [r.notion_page_id as string, r.status as string | null]),
  );

  const rows = rawRows.map((r) => {
    const incomingIsRadar = !r.status || r.status === "radar";
    if (incomingIsRadar) {
      const current = existingStatusMap.get(r.notion_page_id);
      if (current && current !== "radar") {
        return { ...r, status: current }; // Supabase wins — Notion's "radar" is stale
      }
    }
    return r;
  });
  // ─────────────────────────────────────────────────────────────────────────

  // ── URL dedup guard ───────────────────────────────────────────────────────
  // When multiple Notion pages share the same URL (e.g. one per Google Alert
  // email), all N would otherwise be upserted as N separate Supabase rows.
  // Keep only the highest-priority status per URL so deleted duplicates aren't
  // recreated on every sync run.
  const STATUS_SCORE: Record<string, number> = {
    pursuing: 7, reviewing: 6, submitted: 5, won: 5, lost: 5,
    "no-go": 4, "missed deadline": 3, radar: 2,
  };
  function urlStatusScore(s: string | null): number {
    return s ? (STATUS_SCORE[s] ?? 1) : 0;
  }

  const urlBest = new Map<string, { idx: number; score: number }>();
  const deduplicatedRows: typeof rows = [];
  for (const row of rows) {
    if (!row.url) {
      deduplicatedRows.push(row);
      continue;
    }
    const score = urlStatusScore(row.status);
    const prev = urlBest.get(row.url);
    if (prev === undefined) {
      urlBest.set(row.url, { idx: deduplicatedRows.length, score });
      deduplicatedRows.push(row);
    } else if (score > prev.score) {
      deduplicatedRows[prev.idx] = row;
      urlBest.set(row.url, { idx: prev.idx, score });
    }
    // else: existing entry has equal/higher priority — skip this row
  }
  // ─────────────────────────────────────────────────────────────────────────

  const { error, count } = await supabase
    .from("rfp_opportunities")
    .upsert(deduplicatedRows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-rfp-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} rfp opportunities to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}
