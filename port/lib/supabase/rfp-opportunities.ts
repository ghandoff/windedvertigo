/**
 * Supabase layer for rfp_opportunities — reads + atomic proposal-status writes.
 *
 * Maps Supabase rows back to the canonical `RfpOpportunity` type from
 * lib/notion/types. Critically: `id` is set to `notion_page_id` (not the
 * Supabase UUID) so all callers that match against Notion relation arrays
 * continue to work unchanged.
 *
 * Filter parity with lib/notion/rfp-radar.ts queryRfpOpportunities():
 * - status          → exact match on `status`
 * - opportunityType → exact match on `opportunity_type`
 * - wvFitScore      → exact match on `wv_fit_score`
 * - source          → exact match on `source`
 * - search          → ILIKE '%value%' on `opportunity_name`
 * - orgId           → array contains on `organization_ids`
 *
 * Write helpers use Postgres's atomicity to fix a Notion limitation: Notion
 * has no conditional UPDATE, so two concurrent requests could both observe
 * proposalStatus != 'generating' and both start generation. The atomic claim
 * here returns 0 rows when another caller already holds the lock.
 */

import { supabase } from "./client";
import type { RfpOpportunity } from "@/lib/notion/types";

// ─── Row type ────────────────────────────────────────────────────────────────

interface RfpOpportunityRow {
  notion_page_id: string;
  opportunity_name: string;
  status: string | null;
  opportunity_type: string | null;
  organization_ids: string[];
  estimated_value: number | null;
  due_date: string | null;
  wv_fit_score: string | null;
  service_match: string | null;
  category: string | null;
  geography: string | null;
  proposal_status: string | null;
  requirements_snapshot: string | null;
  decision_notes: string | null;
  source: string | null;
}

function mapRowToRfpOpportunity(row: RfpOpportunityRow): RfpOpportunity {
  return {
    id: row.notion_page_id,
    opportunityName: row.opportunity_name,
    status: (row.status as RfpOpportunity["status"]) ?? "radar",
    opportunityType: (row.opportunity_type as RfpOpportunity["opportunityType"]) ?? "RFP",
    organizationIds: row.organization_ids ?? [],
    relatedProjectIds: [],
    ownerIds: [],
    dueDate: row.due_date ? { start: row.due_date, end: null } : null,
    estimatedValue: row.estimated_value ?? null,
    wvFitScore: (row.wv_fit_score as RfpOpportunity["wvFitScore"]) ?? "TBD",
    serviceMatch: row.service_match
      ? (row.service_match.split(",").map((s) => s.trim()) as RfpOpportunity["serviceMatch"])
      : [],
    category: row.category ? row.category.split(",").map((s) => s.trim()) : [],
    geography: row.geography ? row.geography.split(",").map((s) => s.trim()) : [],
    source: (row.source as RfpOpportunity["source"]) ?? "Manual Entry",
    requirementsSnapshot: row.requirements_snapshot ?? "",
    decisionNotes: row.decision_notes ?? "",
    url: "",
    proposalStatus: (row.proposal_status as RfpOpportunity["proposalStatus"]) ?? null,
    proposalDraftUrl: null,
    rfpDocumentUrl: null,
    questionBankUrl: null,
    questionCount: null,
    coverLetterUrl: null,
    teamCvsUrl: null,
    whatWorked: "",
    whatFellFlat: "",
    clientFeedback: "",
    lessonsForNextTime: "",
    proposalNotes: "",
    createdTime: "",
    lastEditedTime: "",
  };
}

// ─── Public filter/pagination interfaces ─────────────────────────────────────

export interface RfpOpportunitySupabaseFilters {
  /** Exact match on pipeline status (radar, reviewing, pursuing, etc.) */
  status?: string;
  /** Exact match on opportunity type (RFP, RFQ, Grant, etc.) */
  opportunityType?: string;
  /** Exact match on wv fit score (high fit, medium fit, low fit, TBD) */
  wvFitScore?: string;
  /** Exact match on source column */
  source?: string;
  /** ILIKE '%search%' on opportunity_name */
  search?: string;
  /** Array-contains filter on organization_ids */
  orgId?: string;
}

export interface RfpOpportunitySupabasePagination {
  page?: number;     // 1-indexed, default 1
  pageSize?: number; // default 100, max 500
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProposalStatus =
  | "generating"
  | "queued"
  | "ready-for-review"
  | "failed"
  | "skipped"
  | null;

const TERMINAL_STATUSES: string[] = ["ready-for-review", "failed", "skipped"];

// ─── Reads ───────────────────────────────────────────────────────────────────

const SELECT_COLS =
  "notion_page_id, opportunity_name, status, opportunity_type, organization_ids, " +
  "estimated_value, due_date, wv_fit_score, service_match, category, geography, " +
  "proposal_status, requirements_snapshot, decision_notes, source";

/**
 * Query rfp_opportunities from Supabase with filter/pagination parity
 * with the Notion queryRfpOpportunities() function.
 *
 * Returns { data, total } where total is the unfiltered-but-filtered count
 * (i.e. total matching rows, ignoring pagination).
 */
export async function getRfpOpportunitiesFromSupabase(
  filters: RfpOpportunitySupabaseFilters = {},
  pagination: RfpOpportunitySupabasePagination = {},
): Promise<{ data: RfpOpportunity[]; total: number }> {
  const page = Math.max(1, pagination.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, pagination.pageSize ?? 100));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("rfp_opportunities")
    .select(SELECT_COLS, { count: "exact" })
    .order("due_date", { ascending: true, nullsFirst: false })
    .range(from, to);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.opportunityType) {
    query = query.eq("opportunity_type", filters.opportunityType);
  }
  if (filters.wvFitScore) {
    query = query.eq("wv_fit_score", filters.wvFitScore);
  }
  if (filters.source) {
    query = query.eq("source", filters.source);
  }
  if (filters.search) {
    query = query.ilike("opportunity_name", `%${filters.search}%`);
  }
  if (filters.orgId) {
    query = query.contains("organization_ids", [filters.orgId]);
  }

  const { data, error, count } = await query;
  if (error)
    throw new Error(`[supabase/rfp-opportunities] query: ${error.message}`);

  return {
    data: (data as unknown as RfpOpportunityRow[]).map(mapRowToRfpOpportunity),
    total: count ?? 0,
  };
}

/**
 * Fetch a single RFP opportunity by its Notion page id.
 */
export async function getRfpOpportunityByIdFromSupabase(
  notionPageId: string,
): Promise<RfpOpportunity | null> {
  const { data, error } = await supabase
    .from("rfp_opportunities")
    .select(SELECT_COLS)
    .eq("notion_page_id", notionPageId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // no rows
    throw new Error(`[supabase/rfp-opportunities] getById: ${error.message}`);
  }
  return data ? mapRowToRfpOpportunity(data as unknown as RfpOpportunityRow) : null;
}

// ─── Atomic proposal-status writes ───────────────────────────────────────────

/**
 * Atomically claim the proposal generation slot for an RFP.
 *
 * Uses a conditional UPDATE so only one caller wins the race:
 *   UPDATE rfp_opportunities
 *   SET proposal_status='generating', proposal_started_at=NOW()
 *   WHERE notion_page_id = $1
 *     AND (proposal_status IS NULL OR proposal_status NOT IN ('generating','queued'))
 *   RETURNING notion_page_id
 *
 * Returns `true` if this caller won the claim, `false` if already claimed.
 * Throws on unexpected DB errors.
 */
export async function claimProposalGeneration(
  notionPageId: string,
): Promise<boolean> {
  // Atomic conditional UPDATE:
  //   UPDATE rfp_opportunities
  //   SET proposal_status='generating', proposal_started_at=NOW()
  //   WHERE notion_page_id = $1
  //     AND (proposal_status IS NULL OR proposal_status NOT IN ('generating','queued'))
  //   RETURNING notion_page_id
  //
  // Zero rows → another caller already holds the lock. Non-zero → we won.
  const { data, error } = await supabase
    .from("rfp_opportunities")
    .update({
      proposal_status: "generating",
      proposal_started_at: new Date().toISOString(),
    })
    .eq("notion_page_id", notionPageId)
    .or("proposal_status.is.null,proposal_status.not.in.(generating,queued)")
    .select("notion_page_id");

  if (error) {
    throw new Error(
      `[supabase/rfp-opportunities] claimProposalGeneration: ${error.message}`,
    );
  }
  return Array.isArray(data) && data.length > 0;
}

/**
 * Update proposal_status (and optionally the timing columns).
 * Used for terminal state transitions: ready-for-review, failed, skipped.
 *
 * Also resets proposal_started_at only when moving to a non-generating state
 * so the timing stays accurate for diagnostics.
 */
export async function setProposalStatus(
  notionPageId: string,
  status: ProposalStatus,
): Promise<void> {
  const updates: Record<string, unknown> = { proposal_status: status };
  if (status !== null && TERMINAL_STATUSES.includes(status)) {
    updates.proposal_completed_at = new Date().toISOString();
  }
  if (status === null) {
    // Reset: clear both timing columns
    updates.proposal_started_at = null;
    updates.proposal_completed_at = null;
  }

  const { error } = await supabase
    .from("rfp_opportunities")
    .update(updates)
    .eq("notion_page_id", notionPageId);

  if (error) {
    throw new Error(
      `[supabase/rfp-opportunities] setProposalStatus: ${error.message}`,
    );
  }
}

/**
 * Auto-reset stuck jobs: any RFP that has been in 'generating' state for
 * longer than `staleMinutes` is moved to 'failed'.
 *
 * Designed to be called from a cron route (e.g. /api/cron/rfp-stuck-reset).
 * Returns the notion_page_ids that were reset.
 */
export async function resetStuckProposals(
  staleMinutes = 10,
): Promise<string[]> {
  const cutoff = new Date(Date.now() - staleMinutes * 60_000).toISOString();

  const { data, error } = await supabase
    .from("rfp_opportunities")
    .update({
      proposal_status: "failed",
      proposal_completed_at: new Date().toISOString(),
    })
    .eq("proposal_status", "generating")
    .lt("proposal_started_at", cutoff)
    .select("notion_page_id");

  if (error) {
    throw new Error(
      `[supabase/rfp-opportunities] resetStuckProposals: ${error.message}`,
    );
  }
  return (data ?? []).map((r) => r.notion_page_id as string);
}
