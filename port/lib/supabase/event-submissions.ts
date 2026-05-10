/**
 * Supabase read/write layer for crm_event_submissions.
 *
 * Phase 6 of the conference intelligence pipeline: each submission (talk,
 * panel, sponsorship, etc.) is a first-class row tied to one crm_events
 * page via event_id. Lets w.v track multiple contributions per conference.
 */

import { supabase } from "./client";

// ── types ────────────────────────────────────────────────────────

export type SubmissionKind =
  | "talk"
  | "panel"
  | "workshop"
  | "sponsorship"
  | "booth"
  | "poster"
  | "other";

export type SubmissionStatus =
  | "drafting"
  | "submitted"
  | "accepted"
  | "rejected"
  | "withdrawn";

export interface EventSubmission {
  id: string;
  eventId: string;
  kind: SubmissionKind;
  title: string;
  abstract: string;
  status: SubmissionStatus;
  decisionAt: string | null;
  presenterContactIds: string[];
  submittedBy: string | null;
  submittedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface SubmissionRow {
  id: string;
  event_id: string;
  kind: string;
  title: string;
  abstract: string | null;
  status: string | null;
  decision_at: string | null;
  presenter_contact_ids: string[] | null;
  submitted_by: string | null;
  submitted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── helpers ──────────────────────────────────────────────────────

const SELECT_COLS =
  "id, event_id, kind, title, abstract, status, decision_at, " +
  "presenter_contact_ids, submitted_by, submitted_at, notes, " +
  "created_at, updated_at";

function mapRowToSubmission(row: SubmissionRow): EventSubmission {
  return {
    id: row.id,
    eventId: row.event_id,
    kind: row.kind as SubmissionKind,
    title: row.title,
    abstract: row.abstract ?? "",
    status: (row.status as SubmissionStatus) ?? "drafting",
    decisionAt: row.decision_at,
    presenterContactIds: row.presenter_contact_ids ?? [],
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── reads ────────────────────────────────────────────────────────

export async function listSubmissionsByEvent(
  eventId: string,
): Promise<EventSubmission[]> {
  const { data, error } = await supabase
    .from("crm_event_submissions")
    .select(SELECT_COLS)
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`[supabase/crm_event_submissions] list: ${error.message}`);
  }
  return (data as unknown as SubmissionRow[]).map(mapRowToSubmission);
}

export async function getSubmissionById(
  id: string,
): Promise<EventSubmission | null> {
  const { data, error } = await supabase
    .from("crm_event_submissions")
    .select(SELECT_COLS)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`[supabase/crm_event_submissions] getById: ${error.message}`);
  }
  return data ? mapRowToSubmission(data as unknown as SubmissionRow) : null;
}

export async function countSubmissionsByEvent(
  eventId: string,
): Promise<{ total: number; accepted: number }> {
  const { data, error } = await supabase
    .from("crm_event_submissions")
    .select("status")
    .eq("event_id", eventId);

  if (error) {
    throw new Error(`[supabase/crm_event_submissions] count: ${error.message}`);
  }
  const rows = (data ?? []) as Array<{ status: string | null }>;
  const total = rows.length;
  const accepted = rows.filter((r) => r.status === "accepted").length;
  return { total, accepted };
}

// ── writes ───────────────────────────────────────────────────────

export async function createSubmission(
  input: Omit<EventSubmission, "id" | "createdAt" | "updatedAt">,
): Promise<EventSubmission> {
  const insert: Omit<SubmissionRow, "id" | "created_at" | "updated_at"> = {
    event_id: input.eventId,
    kind: input.kind,
    title: input.title,
    abstract: input.abstract || null,
    status: input.status,
    decision_at: input.decisionAt,
    presenter_contact_ids: input.presenterContactIds,
    submitted_by: input.submittedBy,
    submitted_at: input.submittedAt,
    notes: input.notes || null,
  };

  const { data, error } = await supabase
    .from("crm_event_submissions")
    .insert(insert)
    .select(SELECT_COLS)
    .single();

  if (error) {
    throw new Error(`[supabase/crm_event_submissions] create: ${error.message}`);
  }
  return mapRowToSubmission(data as unknown as SubmissionRow);
}

export async function updateSubmission(
  id: string,
  patch: Partial<Omit<EventSubmission, "id" | "createdAt" | "updatedAt">>,
): Promise<EventSubmission> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.eventId !== undefined) update.event_id = patch.eventId;
  if (patch.kind !== undefined) update.kind = patch.kind;
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.abstract !== undefined) update.abstract = patch.abstract || null;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.decisionAt !== undefined) update.decision_at = patch.decisionAt;
  if (patch.presenterContactIds !== undefined) {
    update.presenter_contact_ids = patch.presenterContactIds;
  }
  if (patch.submittedBy !== undefined) update.submitted_by = patch.submittedBy;
  if (patch.submittedAt !== undefined) update.submitted_at = patch.submittedAt;
  if (patch.notes !== undefined) update.notes = patch.notes || null;

  const { data, error } = await supabase
    .from("crm_event_submissions")
    .update(update)
    .eq("id", id)
    .select(SELECT_COLS)
    .single();

  if (error) {
    throw new Error(`[supabase/crm_event_submissions] update: ${error.message}`);
  }
  return mapRowToSubmission(data as unknown as SubmissionRow);
}

export async function deleteSubmission(id: string): Promise<void> {
  const { error } = await supabase
    .from("crm_event_submissions")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`[supabase/crm_event_submissions] delete: ${error.message}`);
  }
}
