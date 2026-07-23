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
import { createBizDecision } from "@/lib/biz-data";
import { escalate } from "@/lib/escalation";

export const maxDuration = 60;

const TERMINAL = new Set(["won", "lost", "no-go", "missed deadline"]);
const DELTA_CHANNEL = process.env.SLACK_RFP_CHANNEL ?? "#funding-opportunities";

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
    .select("notion_page_id, status, due_date, opportunity_name")
    .in("notion_page_id", notionIds);

  const existingStatusMap = new Map<string, string | null>(
    (existingRows ?? []).map((r) => [r.notion_page_id as string, r.status as string | null]),
  );

  // ── BIZ-G4: due-date delta detection ────────────────────────────────────
  // "Silent slippage" — a tracked deadline moves in Notion and nobody notices
  // until it's too late. Status changes are already covered by
  // transitionRfpStatus()'s own alerting (won celebration) and
  // biz-go-no-go-sweep's digest, so re-alerting status here would just
  // duplicate that — this only watches due_date, which nothing else tracks.
  const existingDueDateMap = new Map<string, { due_date: string | null; name: string }>(
    (existingRows ?? []).map((r) => [
      r.notion_page_id as string,
      { due_date: r.due_date as string | null, name: r.opportunity_name as string },
    ]),
  );
  const dueDateDeltas: Array<{ notionPageId: string; name: string; from: string | null; to: string | null }> = [];
  for (const row of rawRows) {
    const prior = existingDueDateMap.get(row.notion_page_id);
    if (!prior) continue; // new row this sync — not a "change"
    if (TERMINAL.has(row.status ?? "")) continue; // slippage only matters while still active
    if (prior.due_date !== row.due_date) {
      dueDateDeltas.push({ notionPageId: row.notion_page_id, name: row.opportunity_name || prior.name, from: prior.due_date, to: row.due_date });
    }
  }

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

  // ── name-based dedup: one canonical row per opportunity name ─────────────
  // Same grant can arrive in Notion via two ingest paths (email + RSS), each
  // with a different notion_page_id.  Keep the highest-status copy; delete any
  // existing Supabase rows for the losing notion_page_ids so they don't persist.
  const STATUS_PRIORITY: Record<string, number> = {
    pursuing: 1, interviewing: 2, submitted: 3, won: 4,
    "no-go": 5, lost: 6, "missed deadline": 7, reviewing: 8, radar: 9,
  };
  const nameMap = new Map<string, (typeof rows)[0]>();
  for (const row of rows) {
    const key = (row.opportunity_name ?? "").trim().toLowerCase();
    const incumbent = nameMap.get(key);
    const rowPri = STATUS_PRIORITY[row.status ?? ""] ?? 10;
    const incPri = incumbent ? (STATUS_PRIORITY[incumbent.status ?? ""] ?? 10) : Infinity;
    if (!incumbent || rowPri < incPri) nameMap.set(key, row);
  }
  const dedupedRows = [...nameMap.values()];
  const winnerIds = new Set(dedupedRows.map((r) => r.notion_page_id));
  const loserIds = rows.map((r) => r.notion_page_id).filter((id) => !winnerIds.has(id));

  // A due-date delta on a row that turned out to be a dedup loser isn't a
  // real change worth alerting on — it's about to be evicted.
  const survivingDeltas = dueDateDeltas.filter((d) => winnerIds.has(d.notionPageId));

  if (loserIds.length > 0) {
    const { error: delErr } = await supabase
      .from("rfp_opportunities")
      .delete()
      .in("notion_page_id", loserIds);
    if (delErr) {
      console.warn("[sync-rfp-pilot] dedup delete error:", delErr.message);
    } else {
      console.log(`[sync-rfp-pilot] dedup: evicted ${loserIds.length} duplicate notion page(s)`);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const { error, count } = await supabase
    .from("rfp_opportunities")
    .upsert(dedupedRows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-rfp-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // BIZ-G4: log + alert on this sync's due-date deltas, now that the write succeeded.
  if (survivingDeltas.length > 0) {
    await Promise.all(
      survivingDeltas.map((d) =>
        createBizDecision({
          decision: "due date changed",
          context: `${d.from ?? "(none)"} → ${d.to ?? "(none)"}`,
          category: "delta-alert",
          rfp_id: d.notionPageId,
          logged_by: "sync-rfp-pilot",
        }).catch(() => {}),
      ),
    );

    const lines = [
      `*deadline change${survivingDeltas.length !== 1 ? "s" : ""} detected (${survivingDeltas.length})*`,
      ...survivingDeltas.map((d) => `• ${d.name} — ${d.from ?? "no date"} → ${d.to ?? "no date"}`),
    ];
    // Level 3 of the escalation ladder: topical, threaded channel post —
    // silent deadline slippage is exactly the "genuine gate" this level is for.
    await escalate({
      agent: "biz",
      level: 3,
      channel: DELTA_CHANNEL,
      message: lines.join("\n"),
      context: { rfpIds: survivingDeltas.map((d) => d.notionPageId) },
    }).catch((err) => {
      console.warn("[sync-rfp-pilot] escalate() failed (non-fatal):", err);
    });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} rfp opportunities to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
    dueDateDeltas: survivingDeltas.length,
  });
}
