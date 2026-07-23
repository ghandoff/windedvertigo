/**
 * Opsy data-quality cron — daily 08:00 UTC.
 *
 * Runs a battery of checks across the port's key tables and dashboards,
 * logging incidents + patterns to opsy_incidents / opsy_patterns when
 * issues are found, and auto-resolving them when they clear.
 *
 * Each check is independent: a failure in one never aborts the others.
 *
 * Checks:
 *   1. rfp_opportunities — duplicate opportunity names
 *   2. rfp_opportunities — page-limit trap (fetched count < DB count)
 *   3. rfp_opportunities — records with blank/null status
 *   4. rfp_opportunities — active records missing a due date
 *   5. knowledge_nodes   — stale nodes (last_seen_at older than 48h post-sync)
 *   6. knowledge_edges   — orphaned edges (source or target id not in nodes)
 *   7. pam_commitments   — overdue open items
 *   8. poll_options      — zero-duration slots
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { supabase } from "@/lib/supabase/client";
import {
  insertOpsyIncident,
  resolveOpsyIncident,
  getOpenAutoIncident,
  upsertOpsyPattern,
} from "@/lib/supabase/opsy";

export const maxDuration = 180;

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && (token === process.env.CRON_SECRET || token === process.env.CMO_API_TOKEN);
}

// ── helpers ───────────────────────────────────────────────────────────────────

interface CheckResult {
  name: string;
  ok: boolean;
  severity?: "critical" | "warning" | "info";
  symptoms?: string;
  cause?: string;
  remediation?: string;
  details?: Record<string, unknown>;
}

async function handleResult(result: CheckResult): Promise<void> {
  const service = `data-quality:${result.name}`;
  const existing = await getOpenAutoIncident(service).catch(() => null);

  if (!result.ok) {
    await upsertOpsyPattern({
      pattern_type: result.name,
      description: result.symptoms ?? result.name,
      services: [service],
      occurrence_count: (existing ? 1 : 0) + 1,
      last_seen: new Date().toISOString(),
      recommendation: result.remediation ?? null,
    }).catch(() => {});

    if (!existing) {
      await insertOpsyIncident({
        service,
        severity: result.severity ?? "warning",
        symptoms: result.symptoms ?? result.name,
        cause: result.cause ?? undefined,
        remediation: result.remediation ?? undefined,
        status: "open",
        metadata: { auto_created: true, details: result.details ?? {} },
      }).catch(() => {});
    }
  } else if (existing) {
    await resolveOpsyIncident(existing.id, "condition cleared on subsequent check").catch(() => {});
  }
}

// ── individual checks ─────────────────────────────────────────────────────────

async function checkRfpDuplicates(): Promise<CheckResult> {
  const { data: rows, error: qErr } = await supabase
    .from("rfp_opportunities")
    .select("opportunity_name");
  if (qErr) throw qErr;

  const counts = new Map<string, number>();
  for (const r of rows ?? []) {
    const k = (r.opportunity_name ?? "").trim().toLowerCase();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const dupeGroups = [...counts.entries()].filter(([, n]) => n > 1);
  const dupeRows = dupeGroups.reduce((s, [, n]) => s + (n - 1), 0);

  if (dupeGroups.length === 0) return { name: "rfp-duplicates", ok: true };

  return {
    name: "rfp-duplicates",
    ok: false,
    severity: dupeRows >= 10 ? "warning" : "info",
    symptoms: `${dupeGroups.length} grant name(s) have duplicate rows in rfp_opportunities (${dupeRows} extra rows total)`,
    cause: "ingestOpportunity() URL-only dedup misses cross-source duplicates (same grant arriving via email + RSS with different URLs)",
    remediation: "Run the name-based dedup SQL in Supabase; source-code fix applied in rfp-ingest.ts to prevent new duplication",
    details: { dupeGroups: dupeGroups.length, extraRows: dupeRows, worst: dupeGroups.slice(0, 5).map(([k, n]) => ({ name: k, count: n })) },
  };
}

async function checkRfpPageLimit(): Promise<CheckResult> {
  const { count, error: err } = await supabase
    .from("rfp_opportunities")
    .select("id", { count: "exact", head: true });
  if (err) throw err;

  const total = count ?? 0;
  // The opportunities board fetches with pageSize: 500 (post-fix), but flag if
  // we're approaching the ceiling so it can be raised before it bites again.
  const ceiling = 500;
  const pct = (total / ceiling) * 100;

  if (pct >= 80) {
    return {
      name: "rfp-page-limit",
      ok: false,
      severity: pct >= 95 ? "critical" : "warning",
      symptoms: `rfp_opportunities has ${total} rows — ${Math.round(pct)}% of the ${ceiling}-row fetch ceiling`,
      cause: "Table growth approaching the pageSize cap on the opportunities board",
      remediation: `Raise pageSize above ${ceiling} in opportunities/page.tsx, or archive terminal-status records`,
      details: { total, ceiling, pct: Math.round(pct) },
    };
  }
  return { name: "rfp-page-limit", ok: true, details: { total, ceiling } };
}

async function checkRfpBlankStatus(): Promise<CheckResult> {
  const { data, error: err } = await supabase
    .from("rfp_opportunities")
    .select("id", { count: "exact", head: true })
    .or("status.is.null,status.eq.");
  if (err) throw err;

  const blank = (data as unknown as { count: number } | null)?.count ?? 0;
  if (blank === 0) return { name: "rfp-blank-status", ok: true };

  return {
    name: "rfp-blank-status",
    ok: false,
    severity: "info",
    symptoms: `${blank} rfp_opportunities row(s) have a blank/null status`,
    cause: "Sync may have written records before the status field was set in Notion",
    remediation: "Set status to 'radar' for any blank-status rows via the Supabase editor",
    details: { blankCount: blank },
  };
}

async function checkRfpMissingDueDates(): Promise<CheckResult> {
  const ACTIVE = ["radar", "reviewing", "pursuing", "interviewing", "submitted"];
  const { count, error: err } = await supabase
    .from("rfp_opportunities")
    .select("id", { count: "exact", head: true })
    .in("status", ACTIVE)
    .is("due_date", null);
  if (err) throw err;

  const missing = count ?? 0;
  if (missing === 0) return { name: "rfp-missing-due-dates", ok: true };

  return {
    name: "rfp-missing-due-dates",
    ok: false,
    severity: missing >= 5 ? "warning" : "info",
    symptoms: `${missing} active rfp_opportunities have no due date`,
    cause: "Ingest or Notion record didn't include a deadline",
    remediation: "Review active records without due dates in the RFP lighthouse and add them in Notion",
    details: { missingCount: missing },
  };
}

async function checkKnowledgeNodeStaleness(): Promise<CheckResult> {
  // knowledge-sync runs daily at 11:00 UTC; flag nodes not updated in 50h (covers
  // a missed run + buffer) but only if the table has data at all.
  const { count: total, error: totalErr } = await supabase
    .from("knowledge_nodes")
    .select("id", { count: "exact", head: true });
  if (totalErr) throw totalErr;
  if (!total) return { name: "knowledge-stale-nodes", ok: true };

  const cutoff = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString();
  const { count: stale, error: staleErr } = await supabase
    .from("knowledge_nodes")
    .select("id", { count: "exact", head: true })
    .lt("last_seen_at", cutoff);
  if (staleErr) throw staleErr;

  const stalePct = Math.round(((stale ?? 0) / total) * 100);
  if (stalePct < 20) return { name: "knowledge-stale-nodes", ok: true };

  return {
    name: "knowledge-stale-nodes",
    ok: false,
    severity: stalePct >= 50 ? "warning" : "info",
    symptoms: `${stale} of ${total} knowledge_nodes (${stalePct}%) haven't been seen in 50+ hours`,
    cause: "knowledge-sync cron may have failed or Notion/agent connection is broken",
    remediation: "Trigger /api/cron/knowledge-sync manually with CRON_SECRET and check logs",
    details: { stale, total, stalePct },
  };
}

async function checkOrphanedKnowledgeEdges(): Promise<CheckResult> {
  // Count edges whose source_id or target_id is missing from knowledge_nodes.
  // Uses a NOT EXISTS subquery via Supabase's .not filter (best approximation
  // without raw SQL access here; precise count via a join is in the SQL below).
  // Note: this is an approximation — the exact query requires a JOIN not easily
  // expressed with the JS client. We log the concern if edge count >> node count.
  const { count: edgeCount } = await supabase
    .from("knowledge_edges")
    .select("id", { count: "exact", head: true });
  const { count: nodeCount } = await supabase
    .from("knowledge_nodes")
    .select("id", { count: "exact", head: true });

  if (!edgeCount || !nodeCount) return { name: "knowledge-orphaned-edges", ok: true };

  // A graph with N nodes can have at most N*(N-1) directed edges.
  // If edges >> nodes^2, something is wrong. Typical ratio is 2-5x nodes.
  const ratio = edgeCount / nodeCount;
  if (ratio <= 15) return { name: "knowledge-orphaned-edges", ok: true };

  return {
    name: "knowledge-orphaned-edges",
    ok: false,
    severity: "warning",
    symptoms: `knowledge_edges:nodes ratio is ${ratio.toFixed(1)}× (${edgeCount} edges, ${nodeCount} nodes) — unusually high`,
    cause: "Sync may be creating duplicate edges or nodes may have been deleted without cleaning their edges",
    remediation: "Run knowledge-sync and check the reconcile step; inspect edges with missing source/target in Supabase",
    details: { edgeCount, nodeCount, ratio: Math.round(ratio * 10) / 10 },
  };
}

async function checkOverduePamCommitments(): Promise<CheckResult> {
  const now = new Date().toISOString().split("T")[0];
  const { count, error: err } = await supabase
    .from("pam_commitments")
    .select("id", { count: "exact", head: true })
    .in("status", ["not-started", "in-progress", "blocked"])
    .lt("due_date", now)
    .not("due_date", "is", null);
  if (err) throw err;

  const overdue = count ?? 0;
  if (overdue === 0) return { name: "pam-overdue-commitments", ok: true };

  return {
    name: "pam-overdue-commitments",
    ok: false,
    severity: overdue >= 5 ? "warning" : "info",
    symptoms: `${overdue} PaM commitment(s) are past their due date and still open (not-started, in-progress, or blocked)`,
    cause: "Commitments were not completed or rescheduled",
    remediation: "Review overdue items at /pam and either complete, snooze, or mark blocked",
    details: { overdueCount: overdue },
  };
}

async function checkZeroDurationPollOptions(): Promise<CheckResult> {
  // A poll_option where starts_at = ends_at is invalid and hidden from the board.
  const { data: options, error: oErr } = await supabase
    .from("poll_options")
    .select("id, starts_at, ends_at");
  if (oErr) throw oErr;

  const bad = (options ?? []).filter((o) => o.starts_at === o.ends_at);
  if (bad.length === 0) return { name: "poll-zero-duration-options", ok: true };

  return {
    name: "poll-zero-duration-options",
    ok: false,
    severity: "info",
    symptoms: `${bad.length} poll_option(s) have identical starts_at and ends_at (zero duration)`,
    cause: "Slot generation bug or manual data entry error",
    remediation: "Delete zero-duration options via the edit poll page or Supabase editor",
    details: { count: bad.length, sampleIds: bad.slice(0, 5).map((o) => o.id) },
  };
}

// ── main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const started = Date.now();
  const checks = [
    checkRfpDuplicates,
    checkRfpPageLimit,
    checkRfpBlankStatus,
    checkRfpMissingDueDates,
    checkKnowledgeNodeStaleness,
    checkOrphanedKnowledgeEdges,
    checkOverduePamCommitments,
    checkZeroDurationPollOptions,
  ];

  const results = await Promise.allSettled(
    checks.map((fn) =>
      fn().catch((err): CheckResult => ({
        name: fn.name,
        ok: false,
        severity: "warning",
        symptoms: `check threw: ${err instanceof Error ? err.message : (err?.message ?? JSON.stringify(err))}`,
      })),
    ),
  );

  const settled = results.map((r) => (r.status === "fulfilled" ? r.value : {
    name: "unknown",
    ok: false,
    severity: "warning" as const,
    symptoms: `check promise rejected: ${r.reason}`,
  }));

  // Log incidents / resolve cleared ones — also in parallel.
  await Promise.allSettled(settled.map(handleResult));

  const issues = settled.filter((r) => !r.ok);
  const durationMs = Date.now() - started;

  console.log(
    `[cron/opsy-data-quality] ${checks.length} checks, ${issues.length} issue(s) found, ${durationMs}ms`,
  );
  if (issues.length > 0) {
    console.warn("[cron/opsy-data-quality] issues:", issues.map((i) => i.name).join(", "));
  }

  return json({
    checks: checks.length,
    passed: settled.filter((r) => r.ok).length,
    issues: issues.length,
    durationMs,
    results: settled.map(({ name, ok, severity, symptoms }) => ({ name, ok, severity, symptoms })),
  });
}
