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
  related_project_ids: string[] | null;
  owner_ids: string[] | null;
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
  deadline_timezone: string | null;
  url: string | null;
  rfp_document_url: string | null;
  proposal_draft_url: string | null;
  question_bank_url: string | null;
  question_count: number | null;
  cover_letter_url: string | null;
  team_cvs_url: string | null;
  expression_of_interest_url: string | null;
  financial_proposal_url: string | null;
  what_worked: string | null;
  what_fell_flat: string | null;
  client_feedback: string | null;
  lessons_for_next_time: string | null;
  proposal_notes: string | null;
  influenced_by_event_ids: string[] | null;
  created_time: string | null;
  last_edited_time: string | null;
}

function mapRowToRfpOpportunity(row: RfpOpportunityRow): RfpOpportunity {
  return {
    id: row.notion_page_id,
    opportunityName: row.opportunity_name,
    status: (row.status as RfpOpportunity["status"]) ?? "radar",
    opportunityType: (row.opportunity_type as RfpOpportunity["opportunityType"]) ?? "RFP",
    organizationIds: row.organization_ids ?? [],
    relatedProjectIds: row.related_project_ids ?? [],
    ownerIds: row.owner_ids ?? [],
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
    url: row.url ?? "",
    proposalStatus: (row.proposal_status as RfpOpportunity["proposalStatus"]) ?? null,
    proposalDraftUrl: row.proposal_draft_url ?? null,
    rfpDocumentUrl: row.rfp_document_url ?? null,
    questionBankUrl: row.question_bank_url ?? null,
    questionCount: row.question_count ?? null,
    coverLetterUrl: row.cover_letter_url ?? null,
    teamCvsUrl: row.team_cvs_url ?? null,
    expressionOfInterestUrl: row.expression_of_interest_url ?? null,
    financialProposalUrl: row.financial_proposal_url ?? null,
    whatWorked: row.what_worked ?? "",
    whatFellFlat: row.what_fell_flat ?? "",
    clientFeedback: row.client_feedback ?? "",
    lessonsForNextTime: row.lessons_for_next_time ?? "",
    proposalNotes: row.proposal_notes ?? "",
    deadlineTimezone: row.deadline_timezone ?? null,
    influencedByEventIds: row.influenced_by_event_ids ?? [],
    createdTime: row.created_time ?? "",
    lastEditedTime: row.last_edited_time ?? "",
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

export type ProposalStep =
  | "fetching_rfp"
  | "gathering_context"
  | "reading_document"
  | "matching_citations"
  | "writing_draft"
  | "building_documents"
  | "cover_letter"
  | "team_cvs"
  | null;

const TERMINAL_STATUSES: string[] = ["ready-for-review", "failed", "skipped"];

// ─── Reads ───────────────────────────────────────────────────────────────────

const SELECT_COLS =
  "notion_page_id, opportunity_name, status, opportunity_type, " +
  "organization_ids, related_project_ids, owner_ids, " +
  "estimated_value, due_date, wv_fit_score, service_match, category, geography, source, " +
  "proposal_status, requirements_snapshot, decision_notes, deadline_timezone, " +
  "url, rfp_document_url, proposal_draft_url, question_bank_url, question_count, " +
  "cover_letter_url, team_cvs_url, expression_of_interest_url, financial_proposal_url, " +
  "what_worked, what_fell_flat, client_feedback, " +
  "lessons_for_next_time, proposal_notes, influenced_by_event_ids, " +
  "created_time, last_edited_time";

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
  if (status === "generating") {
    // Set the start timestamp so the sweep cron can use it for the
    // `proposal_started_at < cutoff` branch (instead of relying solely
    // on the IS NULL branch which catches all generating records regardless
    // of age — potentially too aggressive for records < 10 min old).
    updates.proposal_started_at = new Date().toISOString();
  }
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
 * Write the generated proposal document URLs to Supabase immediately after
 * generation completes so they're visible on page refresh without waiting for
 * the 15-min sync cron. The progress tracker calls router.refresh() the moment
 * it sees "ready-for-review", so Supabase must already have the URLs at that point.
 * Fire-and-forget safe — never throws.
 */
export async function setProposalUrls(
  notionPageId: string,
  urls: {
    proposalDraftUrl?: string | null;
    coverLetterUrl?: string | null;
    teamCvsUrl?: string | null;
    expressionOfInterestUrl?: string | null;
    financialProposalUrl?: string | null;
  },
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (urls.proposalDraftUrl !== undefined) updates.proposal_draft_url = urls.proposalDraftUrl;
  if (urls.coverLetterUrl !== undefined) updates.cover_letter_url = urls.coverLetterUrl;
  if (urls.teamCvsUrl !== undefined) updates.team_cvs_url = urls.teamCvsUrl;
  if (urls.expressionOfInterestUrl !== undefined) updates.expression_of_interest_url = urls.expressionOfInterestUrl;
  if (urls.financialProposalUrl !== undefined) updates.financial_proposal_url = urls.financialProposalUrl;

  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase
    .from("rfp_opportunities")
    .update(updates)
    .eq("notion_page_id", notionPageId);

  if (error) {
    console.warn(`[supabase/rfp-opportunities] setProposalUrls: ${error.message}`);
  }
}

/**
 * Write the current Inngest phase during proposal generation.
 * Fire-and-forget safe — logs a warning but never throws so it can't
 * block the critical generation path.
 */
export async function setProposalStep(
  notionPageId: string,
  step: ProposalStep,
): Promise<void> {
  const { error } = await supabase
    .from("rfp_opportunities")
    .update({ proposal_step: step })
    .eq("notion_page_id", notionPageId);

  if (error) {
    console.warn(`[supabase/rfp-opportunities] setProposalStep: ${error.message}`);
  }
}

/**
 * Immediately sync a newly-created Notion RFP record to Supabase, including
 * the `deadline_timezone` that the triage extracted (which the 15-min cron
 * would otherwise miss since it reads from Notion and Notion has no timezone field).
 *
 * Fire-and-forget safe — logs a warning but never throws.
 */
export async function upsertRfpOpportunityToSupabase(
  opp: RfpOpportunity,
  deadlineTimezone: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("rfp_opportunities")
    .upsert(
      {
        notion_page_id: opp.id,
        opportunity_name: opp.opportunityName ?? "",
        status: opp.status ?? null,
        opportunity_type: opp.opportunityType ?? null,
        organization_ids: opp.organizationIds ?? [],
        estimated_value: opp.estimatedValue ?? null,
        due_date: opp.dueDate?.start ?? null,
        wv_fit_score: opp.wvFitScore ?? null,
        service_match: Array.isArray(opp.serviceMatch)
          ? opp.serviceMatch.join(",") : (opp.serviceMatch ?? null),
        category: Array.isArray(opp.category)
          ? opp.category.join(",") : (opp.category ?? null),
        geography: Array.isArray(opp.geography)
          ? opp.geography.join(",") : (opp.geography ?? null),
        source: opp.source ?? null,
        proposal_status: opp.proposalStatus ?? null,
        requirements_snapshot: opp.requirementsSnapshot ?? null,
        decision_notes: opp.decisionNotes ?? null,
        url: opp.url || null,
        rfp_document_url: opp.rfpDocumentUrl ?? null,
        proposal_draft_url: opp.proposalDraftUrl ?? null,
        deadline_timezone: deadlineTimezone,
        created_time: opp.createdTime || null,
        last_edited_time: opp.lastEditedTime || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "notion_page_id" },
    );

  if (error) {
    console.warn(`[supabase/rfp-opportunities] upsertRfpOpportunityToSupabase: ${error.message}`);
  }
}

/**
 * Store the funder's IANA timezone (e.g. "Europe/Copenhagen") so the
 * UI can convert the due date to Pacific Time for display.
 * Fire-and-forget safe — never throws.
 */
export async function setDeadlineTimezone(
  notionPageId: string,
  timezone: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("rfp_opportunities")
    .update({ deadline_timezone: timezone })
    .eq("notion_page_id", notionPageId);
  if (error) {
    console.warn(`[supabase/rfp-opportunities] setDeadlineTimezone: ${error.message}`);
  }
}

/**
 * Sync the R2 document URL to Supabase immediately after upload.
 * The detail page reads rfp_document_url from Supabase; without this write
 * the page shows "no document" until the next sync cron (~15 min).
 */
export async function setRfpDocumentUrl(
  notionPageId: string,
  url: string,
): Promise<void> {
  const { error } = await supabase
    .from("rfp_opportunities")
    .update({ rfp_document_url: url })
    .eq("notion_page_id", notionPageId);
  if (error) {
    console.warn(`[supabase/rfp-opportunities] setRfpDocumentUrl: ${error.message}`);
  }
}

/**
 * Mark a proposal as permanently failed in Supabase — called by the Inngest
 * failure handler after all retries are exhausted. Without this, the progress
 * tracker would keep polling Supabase forever because the failure handler only
 * updates Notion, leaving Supabase stuck at "generating".
 */
export async function resetProposalToFailed(notionPageId: string): Promise<void> {
  const { error } = await supabase
    .from("rfp_opportunities")
    .update({
      proposal_status: "failed",
      proposal_step: null,
      proposal_completed_at: new Date().toISOString(),
    })
    .eq("notion_page_id", notionPageId);

  if (error) {
    console.warn(`[supabase/rfp-opportunities] resetProposalToFailed: ${error.message}`);
  }
}

/**
 * Read proposal generation progress from Supabase — used by the
 * status-polling API route so the client avoids slow Notion reads.
 */
export async function getProposalProgress(notionPageId: string): Promise<{
  status: string | null;
  step: string | null;
  startedAt: string | null;
  completedAt: string | null;
} | null> {
  const { data, error } = await supabase
    .from("rfp_opportunities")
    .select("proposal_status, proposal_step, proposal_started_at, proposal_completed_at")
    .eq("notion_page_id", notionPageId)
    .single();

  if (error || !data) return null;

  return {
    status: data.proposal_status as string | null,
    step: data.proposal_step as string | null,
    startedAt: data.proposal_started_at as string | null,
    completedAt: data.proposal_completed_at as string | null,
  };
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

// ─── Phase 8: ROI attribution from conferences ─────────────────────────────

/**
 * Set the conference event ids that influenced this opportunity. Stored
 * as Supabase-only data (no Notion property) because the column was added
 * by the conference-intelligence migration on 2026-05-08.
 *
 * Idempotent: pass the full list of event_ids; existing values are
 * replaced. Empty array clears the link.
 */
export async function setRfpInfluencedByEventIds(
  rfpId: string,
  eventIds: string[],
): Promise<void> {
  const { error } = await supabase
    .from("rfp_opportunities")
    .update({ influenced_by_event_ids: eventIds })
    .eq("notion_page_id", rfpId);
  if (error) {
    throw new Error(
      `[supabase/rfp-opportunities] setRfpInfluencedByEventIds: ${error.message}`,
    );
  }
}

/**
 * Update the main pipeline status for an RFP opportunity.
 * Called from PATCH /api/rfp-radar/[id] so Supabase stays in sync
 * with the Notion write that happens in the same request.
 *
 * Throws on error — the PATCH handler awaits this before the Notion write,
 * so a silent swallow would leave Supabase stale (defeating the purpose).
 * Callers that want fire-and-forget should catch() themselves.
 */
export async function setRfpStatus(
  notionPageId: string,
  status: string,
): Promise<void> {
  const { error } = await supabase
    .from("rfp_opportunities")
    .update({ status })
    .eq("notion_page_id", notionPageId);
  if (error) {
    throw new Error(`[supabase/rfp-opportunities] setRfpStatus: ${error.message}`);
  }
}

/**
 * Sync all user-editable fields from the RFP edit form to Supabase.
 *
 * Called from PATCH /api/rfp-radar/[id] before the Notion write, so
 * router.refresh() always sees the updated values (Supabase is the read
 * layer; Notion-only writes leave the page showing stale data until the
 * sync cron fires ~15 min later).
 *
 * Only fields present in `fields` are included in the SQL UPDATE — undefined
 * values are omitted so unrelated columns are never clobbered.
 */
export async function setRfpEditableFields(
  notionPageId: string,
  fields: {
    opportunityName?: string;
    opportunityType?: string | null;
    dueDate?: { start: string; end: string | null } | null;
    estimatedValue?: number | null;
    wvFitScore?: string | null;
    serviceMatch?: string[];
    category?: string[];
    geography?: string[];
    source?: string | null;
    url?: string | null;
    requirementsSnapshot?: string | null;
    decisionNotes?: string | null;
    whatWorked?: string | null;
    whatFellFlat?: string | null;
    clientFeedback?: string | null;
    lessonsForNextTime?: string | null;
    proposalNotes?: string | null;
  },
): Promise<void> {
  // Build the Supabase update object — only include fields that were provided.
  const update: Record<string, unknown> = {};

  if (fields.opportunityName !== undefined)
    update.opportunity_name = fields.opportunityName;
  if (fields.opportunityType !== undefined)
    update.opportunity_type = fields.opportunityType ?? null;
  if (fields.dueDate !== undefined)
    update.due_date = fields.dueDate?.start ?? null;
  if (fields.estimatedValue !== undefined)
    update.estimated_value = fields.estimatedValue ?? null;
  if (fields.wvFitScore !== undefined)
    update.wv_fit_score = fields.wvFitScore ?? null;
  if (fields.serviceMatch !== undefined)
    update.service_match = fields.serviceMatch.length > 0 ? fields.serviceMatch.join(", ") : null;
  if (fields.category !== undefined)
    update.category = fields.category.length > 0 ? fields.category.join(", ") : null;
  if (fields.geography !== undefined)
    update.geography = fields.geography.length > 0 ? fields.geography.join(", ") : null;
  if (fields.source !== undefined)
    update.source = fields.source ?? null;
  if (fields.url !== undefined)
    update.url = fields.url ?? null;
  if (fields.requirementsSnapshot !== undefined)
    update.requirements_snapshot = fields.requirementsSnapshot ?? null;
  if (fields.decisionNotes !== undefined)
    update.decision_notes = fields.decisionNotes ?? null;
  if (fields.whatWorked !== undefined)
    update.what_worked = fields.whatWorked ?? null;
  if (fields.whatFellFlat !== undefined)
    update.what_fell_flat = fields.whatFellFlat ?? null;
  if (fields.clientFeedback !== undefined)
    update.client_feedback = fields.clientFeedback ?? null;
  if (fields.lessonsForNextTime !== undefined)
    update.lessons_for_next_time = fields.lessonsForNextTime ?? null;
  if (fields.proposalNotes !== undefined)
    update.proposal_notes = fields.proposalNotes ?? null;

  if (Object.keys(update).length === 0) return; // nothing to update

  const { error } = await supabase
    .from("rfp_opportunities")
    .update(update)
    .eq("notion_page_id", notionPageId);
  if (error) {
    throw new Error(`[supabase/rfp-opportunities] setRfpEditableFields: ${error.message}`);
  }
}
