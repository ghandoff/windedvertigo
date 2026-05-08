/**
 * Supabase read/write layer for crm_event_contacts.
 *
 * The join table tracking which external contacts the team wants to meet,
 * met, and is following up with — per event. Mirrors the structure of
 * lib/supabase/events.ts.
 *
 * Phase 7 (conference intelligence pipeline).
 */

import { supabase } from "./client";

// ── types ────────────────────────────────────────────────────────

export type ContactAttendanceStatus = "target" | "met" | "followed_up" | "dropped";

interface EventContactRow {
  id: string;
  event_id: string;
  contact_id: string;
  status: string;
  notes: string | null;
  met_at: string | null;
  followed_up_at: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

interface JoinedContactRow extends EventContactRow {
  contacts: {
    name: string;
    role: string | null;
    org_id: string | null;
    organizations: { name: string } | null;
  } | null;
}

export interface EventContact {
  id: string;
  eventId: string;
  contactId: string;
  status: ContactAttendanceStatus;
  notes: string;
  metAt: string | null;
  followedUpAt: string | null;
  addedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Joined row — includes the contact's name + organization for display. */
export interface EventContactWithDetails extends EventContact {
  contactName: string;
  contactRole: string | null;
  contactOrgName: string | null;
}

// ── helpers ──────────────────────────────────────────────────────

function mapRowToEventContact(row: EventContactRow): EventContact {
  return {
    id: row.id,
    eventId: row.event_id,
    contactId: row.contact_id,
    status: (row.status as ContactAttendanceStatus) ?? "target",
    notes: row.notes ?? "",
    metAt: row.met_at,
    followedUpAt: row.followed_up_at,
    addedBy: row.added_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapJoinedRowToDetails(row: JoinedContactRow): EventContactWithDetails {
  const base = mapRowToEventContact(row);
  return {
    ...base,
    contactName: row.contacts?.name ?? "(unknown contact)",
    contactRole: row.contacts?.role ?? null,
    contactOrgName: row.contacts?.organizations?.name ?? null,
  };
}

const SELECT_COLS =
  "id, event_id, contact_id, status, notes, met_at, followed_up_at, " +
  "added_by, created_at, updated_at";

// ── queries ──────────────────────────────────────────────────────

/**
 * List contacts linked to an event, joined against the contacts table so
 * the UI can show name + role + org without an extra fetch round-trip.
 *
 * The join uses the foreign-key path:
 *   crm_event_contacts.contact_id → contacts.notion_page_id → organizations.notion_page_id
 */
export async function listContactsByEvent(
  eventId: string,
): Promise<EventContactWithDetails[]> {
  const { data, error } = await supabase
    .from("crm_event_contacts")
    .select(
      `${SELECT_COLS},
       contacts:contact_id (
         name,
         role,
         org_id,
         organizations:org_id ( name )
       )`,
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`[supabase/crm_event_contacts] list: ${error.message}`);
  }
  return (data as unknown as JoinedContactRow[]).map(mapJoinedRowToDetails);
}

/**
 * Fetch a single event-contact link by its uuid id.
 */
export async function getEventContactById(
  id: string,
): Promise<EventContact | null> {
  const { data, error } = await supabase
    .from("crm_event_contacts")
    .select(SELECT_COLS)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`[supabase/crm_event_contacts] getById: ${error.message}`);
  }
  return data ? mapRowToEventContact(data as unknown as EventContactRow) : null;
}

// ── writes ───────────────────────────────────────────────────────

/**
 * Link a contact to an event as a "target". The unique(event_id, contact_id)
 * constraint prevents duplicates — callers should handle the 23505
 * unique-violation error code.
 */
export async function linkContactToEvent(input: {
  eventId: string;
  contactId: string;
  addedBy: string;
  notes?: string;
}): Promise<EventContact> {
  const { data, error } = await supabase
    .from("crm_event_contacts")
    .insert({
      event_id: input.eventId,
      contact_id: input.contactId,
      added_by: input.addedBy,
      notes: input.notes ?? null,
      status: "target",
    })
    .select(SELECT_COLS)
    .single();

  if (error) {
    throw new Error(`[supabase/crm_event_contacts] link: ${error.message}`);
  }
  return mapRowToEventContact(data as unknown as EventContactRow);
}

/**
 * Update status / notes on an existing link. Idempotently stamps met_at
 * and followed_up_at the first time a row transitions into those states —
 * we never overwrite a pre-existing timestamp.
 */
export async function updateEventContactStatus(
  id: string,
  patch: { status?: ContactAttendanceStatus; notes?: string },
): Promise<EventContact> {
  // Fetch current row so we can decide whether to stamp met_at /
  // followed_up_at — preserves idempotency on repeat clicks.
  const current = await getEventContactById(id);
  if (!current) {
    throw new Error(`[supabase/crm_event_contacts] update: row ${id} not found`);
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.status !== undefined) {
    update.status = patch.status;
    if (patch.status === "met" && !current.metAt) {
      update.met_at = new Date().toISOString();
    }
    if (patch.status === "followed_up" && !current.followedUpAt) {
      update.followed_up_at = new Date().toISOString();
    }
  }
  if (patch.notes !== undefined) {
    update.notes = patch.notes;
  }

  const { data, error } = await supabase
    .from("crm_event_contacts")
    .update(update)
    .eq("id", id)
    .select(SELECT_COLS)
    .single();

  if (error) {
    throw new Error(`[supabase/crm_event_contacts] update: ${error.message}`);
  }
  return mapRowToEventContact(data as unknown as EventContactRow);
}

/**
 * Remove a contact-event link. Hard delete — there's no soft-delete column
 * on this table, and cascade is handled by the FK on event_id.
 */
export async function unlinkContactFromEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from("crm_event_contacts")
    .delete()
    .eq("id", id);
  if (error) {
    throw new Error(`[supabase/crm_event_contacts] unlink: ${error.message}`);
  }
}

/**
 * Aggregate counts by status for a single event. Used by the collapsed
 * panel header summary line ("0 target · 0 met · 0 followed-up").
 */
export async function countContactsByEvent(
  eventId: string,
): Promise<{ target: number; met: number; followedUp: number; dropped: number }> {
  const { data, error } = await supabase
    .from("crm_event_contacts")
    .select("status")
    .eq("event_id", eventId);

  if (error) {
    throw new Error(`[supabase/crm_event_contacts] count: ${error.message}`);
  }

  const counts = { target: 0, met: 0, followedUp: 0, dropped: 0 };
  for (const row of (data ?? []) as { status: string }[]) {
    if (row.status === "target") counts.target += 1;
    else if (row.status === "met") counts.met += 1;
    else if (row.status === "followed_up") counts.followedUp += 1;
    else if (row.status === "dropped") counts.dropped += 1;
  }
  return counts;
}
