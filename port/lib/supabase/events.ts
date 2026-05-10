/**
 * Supabase read layer for events (CrmEvent — Events & Conferences).
 *
 * Filter parity with lib/notion/events.ts queryEvents():
 * - type → direct column match
 * - whoShouldAttend → contains("who_should_attend", [value])
 * - search → ILIKE '%value%' on event name
 * - upcoming → event_start >= today (no archived concept for events)
 *
 * Phase G.1.3: GET /api/events now reads from Supabase.
 * POST still writes to Notion — source of truth.
 */

import { supabase } from "./client";
import type {
  CrmEvent,
  ConferenceStatus,
  ConferenceLifecycle,
  ConferenceDiscoverySource,
  ConferenceDeadline,
  WvFitScore,
} from "@/lib/notion/types";

// ── types ────────────────────────────────────────────────────────

interface EventRow {
  notion_page_id: string;
  event: string;
  type: string | null;
  event_start: string | null;
  event_end: string | null;
  proposal_deadline: string | null;
  frequency: string | null;
  location: string | null;
  est_attendance: string | null;
  registration_cost: string | null;
  quadrant_relevance: string[];
  bd_segments: string | null;
  who_should_attend: string[];
  why_it_matters: string | null;
  notes: string | null;
  url: string | null;
  // ── Phase 1 triage + lifecycle ─────────────────────────────
  status: string | null;
  lifecycle_state: string | null;
  fit_score: string | null;
  triage_notes: string | null;
  triaged_at: string | null;
  triaged_by: string | null;
  owner_user_id: string | null;
  discovered_via: string | null;
  discovered_at: string | null;
  external_id: string | null;
  raw_payload_json: unknown | null;
  affiliated_org_id: string | null;
  deadlines: ConferenceDeadline[] | null;
  est_travel_cost: number | null;
  sponsorship_fee: number | null;
  actual_cost_total: number | null;
  currency: string | null;
  outcome_notes: string | null;
  contacts_met_count: number | null;
  followup_due_by: string | null;
  // ── Phase 16 cover image ────────────────────────────────────────
  cover_image_url: string | null;
}

export interface EventSupabaseFilters {
  type?: string;
  whoShouldAttend?: string;
  upcoming?: boolean;
  search?: string;
  // ── Phase 1 ────────────────────────────────────────────────
  status?: ConferenceStatus;
  lifecycleState?: ConferenceLifecycle;
  discoveredVia?: ConferenceDiscoverySource;
  ownerUserId?: string;
  affiliatedOrgId?: string;
  /** when true, also include rows with status='not_relevant' (default: hide them) */
  includeNotRelevant?: boolean;
  /** when true, only return rows where proposal_deadline IS NOT NULL */
  hasDeadline?: boolean;
}

export interface EventSupabasePagination {
  page?: number;
  pageSize?: number;
  /** column to sort by (default: "event") */
  sortBy?: string;
  /** sort direction (default: "asc") */
  sortDir?: "asc" | "desc";
}

// ── helpers ──────────────────────────────────────────────────────

function mapRowToEvent(row: EventRow): CrmEvent {
  const toDateRange = (start: string | null, end: string | null) => {
    if (!start && !end) return null;
    return { start: start ?? "", end: end ?? null };
  };

  return {
    id: row.notion_page_id,
    event: row.event,
    type: (row.type as CrmEvent["type"]) ?? "Conference",
    eventDates: toDateRange(row.event_start, row.event_end),
    proposalDeadline: row.proposal_deadline ? { start: row.proposal_deadline, end: null } : null,
    frequency: (row.frequency as CrmEvent["frequency"]) ?? null,
    location: row.location ?? "",
    estAttendance: row.est_attendance ?? "",
    registrationCost: row.registration_cost ?? "",
    quadrantRelevance: (row.quadrant_relevance ?? []) as CrmEvent["quadrantRelevance"],
    bdSegments: row.bd_segments ?? "",
    whoShouldAttend: (row.who_should_attend ?? []) as CrmEvent["whoShouldAttend"],
    whyItMatters: row.why_it_matters ?? "",
    notes: row.notes ?? "",
    url: row.url ?? "",
    lastEditedTime: "",

    // ── Phase 1 ─────────────────────────────────────────────
    status: (row.status as ConferenceStatus) ?? "watch",
    lifecycleState: (row.lifecycle_state as ConferenceLifecycle) ?? "upcoming",
    fitScore: (row.fit_score as WvFitScore) ?? null,
    triageNotes: row.triage_notes ?? "",
    triagedBy: row.triaged_by,
    triagedAt: row.triaged_at,
    ownerUserId: row.owner_user_id,
    discoveredVia: (row.discovered_via as ConferenceDiscoverySource) ?? "manual",
    discoveredAt: row.discovered_at ?? "",
    externalId: row.external_id,
    rawPayloadJson: row.raw_payload_json,
    affiliatedOrgId: row.affiliated_org_id,
    deadlines: row.deadlines ?? [],
    estTravelCost: row.est_travel_cost,
    sponsorshipFee: row.sponsorship_fee,
    actualCostTotal: row.actual_cost_total,
    currency: row.currency ?? "USD",
    outcomeNotes: row.outcome_notes ?? "",
    contactsMetCount: row.contacts_met_count,
    followupDueBy: row.followup_due_by,
    // Phase 16
    coverImageUrl: row.cover_image_url ?? null,
  };
}

const SELECT_COLS =
  "notion_page_id, event, type, event_start, event_end, proposal_deadline, frequency, " +
  "location, est_attendance, registration_cost, quadrant_relevance, bd_segments, " +
  "who_should_attend, why_it_matters, notes, url, " +
  // Phase 1 triage + lifecycle + provenance + costs + retro
  "status, lifecycle_state, fit_score, triage_notes, triaged_at, triaged_by, " +
  "owner_user_id, discovered_via, discovered_at, external_id, raw_payload_json, " +
  "affiliated_org_id, deadlines, est_travel_cost, sponsorship_fee, " +
  "actual_cost_total, currency, outcome_notes, contacts_met_count, followup_due_by, " +
  // Phase 16 cover image
  "cover_image_url";

// ── query functions ───────────────────────────────────────────────

export async function getEventsFromSupabase(
  filters: EventSupabaseFilters = {},
  pagination: EventSupabasePagination = {},
): Promise<{ data: CrmEvent[]; total: number }> {
  const page = Math.max(1, pagination.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, pagination.pageSize ?? 100));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const sortCol = pagination.sortBy ?? "event";
  const sortAsc = (pagination.sortDir ?? "asc") === "asc";

  let query = supabase
    .from("crm_events")
    .select(SELECT_COLS, { count: "exact" })
    .order(sortCol, { ascending: sortAsc })
    .range(from, to);

  if (filters.type)            query = query.eq("type", filters.type);
  if (filters.whoShouldAttend)  query = query.contains("who_should_attend", [filters.whoShouldAttend]);
  if (filters.upcoming)        query = query.gte("event_start", new Date().toISOString().slice(0, 10));
  if (filters.search)          query = query.ilike("event", `%${filters.search}%`);
  // Phase 1 triage filters.
  if (filters.status)          query = query.eq("status", filters.status);
  if (filters.lifecycleState)  query = query.eq("lifecycle_state", filters.lifecycleState);
  if (filters.discoveredVia)   query = query.eq("discovered_via", filters.discoveredVia);
  if (filters.ownerUserId)     query = query.eq("owner_user_id", filters.ownerUserId);
  if (filters.affiliatedOrgId) query = query.eq("affiliated_org_id", filters.affiliatedOrgId);
  // Default view hides 'not_relevant' rows; reveal explicitly via includeNotRelevant
  // OR by passing status='not_relevant' as the explicit filter.
  if (!filters.includeNotRelevant && filters.status !== "not_relevant") {
    query = query.neq("status", "not_relevant");
  }
  if (filters.hasDeadline) query = query.not("proposal_deadline", "is", null);

  const { data, error, count } = await query;
  if (error) throw new Error(`[supabase/crm_events] query: ${error.message}`);
  return {
    data: (data as unknown as EventRow[]).map(mapRowToEvent),
    total: count ?? 0,
  };
}

/**
 * Fetch a single event by its Notion page id.
 */
export async function getEventByIdFromSupabase(
  notionPageId: string,
): Promise<CrmEvent | null> {
  const { data, error } = await supabase
    .from("crm_events")
    .select(SELECT_COLS)
    .eq("notion_page_id", notionPageId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`[supabase/crm_events] getById: ${error.message}`);
  }
  return data ? mapRowToEvent(data as unknown as EventRow) : null;
}

// ── write functions ───────────────────────────────────────────────

/**
 * Upsert an event. Uses notion_page_id as the conflict target.
 */
export async function upsertEventToSupabase(
  notionPageId: string,
  data: Partial<Omit<EventRow, "notion_page_id">>,
): Promise<void> {
  const { error } = await supabase
    .from("crm_events")
    .upsert({ notion_page_id: notionPageId, ...data }, { onConflict: "notion_page_id" });
  if (error) throw new Error(`[supabase/crm_events] upsert: ${error.message}`);
}

/**
 * Delete an event row.
 */
export async function deleteEventFromSupabase(notionPageId: string): Promise<void> {
  const { error } = await supabase
    .from("crm_events")
    .delete()
    .eq("notion_page_id", notionPageId);
  if (error) throw new Error(`[supabase/crm_events] delete: ${error.message}`);
}

// ── triage writers (Phase 1) ──────────────────────────────────────

export interface TriageUpdate {
  status?: ConferenceStatus;
  lifecycleState?: ConferenceLifecycle;
  fitScore?: WvFitScore | null;
  triageNotes?: string;
  ownerUserId?: string | null;
  triagedBy: string;            // required — who clicked the button
}

/**
 * Apply a triage decision to an event row. Always stamps `triaged_at` to now()
 * and `triaged_by` to the caller. Partial — only the keys you pass are written.
 */
export async function setEventTriageStatus(
  notionPageId: string,
  update: TriageUpdate,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {
    triaged_at: new Date().toISOString(),
    triaged_by: update.triagedBy,
  };
  if (update.status !== undefined)         patch.status = update.status;
  if (update.lifecycleState !== undefined) patch.lifecycle_state = update.lifecycleState;
  if (update.fitScore !== undefined)       patch.fit_score = update.fitScore;
  if (update.triageNotes !== undefined)    patch.triage_notes = update.triageNotes;
  if (update.ownerUserId !== undefined)    patch.owner_user_id = update.ownerUserId;

  const { error } = await supabase
    .from("crm_events")
    .update(patch)
    .eq("notion_page_id", notionPageId);
  if (error) throw new Error(`[supabase/crm_events] triage: ${error.message}`);
}
