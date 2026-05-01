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
import type { CrmEvent } from "@/lib/notion/types";

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
}

export interface EventSupabaseFilters {
  type?: string;
  whoShouldAttend?: string;
  upcoming?: boolean;
  search?: string;
}

export interface EventSupabasePagination {
  page?: number;
  pageSize?: number;
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
  };
}

const SELECT_COLS =
  "notion_page_id, event, type, event_start, event_end, proposal_deadline, frequency, " +
  "location, est_attendance, registration_cost, quadrant_relevance, bd_segments, " +
  "who_should_attend, why_it_matters, notes, url";

// ── query functions ───────────────────────────────────────────────

export async function getEventsFromSupabase(
  filters: EventSupabaseFilters = {},
  pagination: EventSupabasePagination = {},
): Promise<{ data: CrmEvent[]; total: number }> {
  const page = Math.max(1, pagination.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, pagination.pageSize ?? 100));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("crm_events")
    .select(SELECT_COLS, { count: "exact" })
    .order("event", { ascending: true })
    .range(from, to);

  if (filters.type)           query = query.eq("type", filters.type);
  if (filters.whoShouldAttend) query = query.contains("who_should_attend", [filters.whoShouldAttend]);
  if (filters.upcoming)       query = query.gte("event_start", new Date().toISOString().slice(0, 10));
  if (filters.search)         query = query.ilike("event", `%${filters.search}%`);

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
