/**
 * Row types for the wv-booking schema. Source of truth:
 * windedvertigo/supabase/migrations/0001_booking_init.sql
 */

export type EventTypeMode = "solo" | "collective" | "round_robin";
export type BookingStatus = "confirmed" | "cancelled" | "rescheduled";
export type OverrideKind = "block" | "extra";

export type WorkingHours = Record<string, [string, string][]>;

export interface Host {
  id: string;
  slug: string;
  display_name: string;
  email: string;
  timezone: string;
  working_hours: WorkingHours;
  poll_hours?: WorkingHours | null;
  buffer_before_min: number;
  buffer_after_min: number;
  active: boolean;
  created_at: string;
}

export interface OauthToken {
  host_id: string;
  provider: string;
  refresh_token_ct: string;
  refresh_token_iv: string;
  access_token: string | null;
  access_expires_at: string | null;
  scope: string;
  google_account_email: string;
  updated_at: string;
}

export interface EventType {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_min: number;
  duration_options: number[];
  mode: EventTypeMode;
  host_pool: string[];
  min_required: number;
  primary_host_id: string | null;
  notice_min: number;
  horizon_days: number;
  slot_step_min: number;
  active: boolean;
  intake_required: boolean;
  created_at: string;
}

export interface Booking {
  id: string;
  event_type_id: string;
  assigned_host_id: string;
  collective_host_ids: string[];
  during: string;
  visitor_name: string;
  visitor_email: string;
  visitor_tz: string;
  intake: Record<string, unknown> | null;
  google_event_id: string | null;
  meet_url: string | null;
  status: BookingStatus;
  created_at: string;
  cancelled_at: string | null;
}

export interface AvailabilityOverride {
  id: string;
  host_id: string;
  during: string;
  kind: OverrideKind;
  reason: string | null;
}

export interface BookingAuditEntry {
  id: number;
  booking_id: string | null;
  action: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface BookingRange {
  start: Date;
  end: Date;
}

export function parseTstzrange(literal: string): BookingRange {
  const m = literal.match(/^[\[(]"?([^,"]+)"?,"?([^)\]"]+)"?[)\]]$/);
  if (!m) throw new Error(`invalid tstzrange: ${literal}`);
  return {
    start: new Date(m[1].trim().replace(" ", "T")),
    end: new Date(m[2].trim().replace(" ", "T")),
  };
}

export function tstzrange(start: Date, end: Date): string {
  return `[${start.toISOString()},${end.toISOString()})`;
}

// ── polls ─────────────────────────────────────────────────────────

export type PollAvailability = "yes" | "if_need_be" | "no";

export interface Poll {
  id: string;
  slug: string;
  edit_token: string;
  title: string;
  description: string | null;
  created_by_host_id: string | null;
  locked_option_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  starts_at: string;
  ends_at: string;
  sort_order: number;
}

export interface PollResponse {
  id: string;
  poll_id: string;
  respondent_name: string;
  created_at: string;
}

export interface PollResponseChoice {
  id: string;
  response_id: string;
  option_id: string;
  availability: PollAvailability;
}

/** Aggregated tally for one option — computed client-side or server-side. */
export interface PollOptionTally {
  option: PollOption;
  yes: number;
  if_need_be: number;
  no: number;
  respondents: { name: string; availability: PollAvailability }[];
  isBest: boolean;
}
