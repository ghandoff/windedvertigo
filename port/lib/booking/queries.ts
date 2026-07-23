/**
 * Read functions for the wv-booking schema. Used by the port's bookings panel.
 *
 * Pagination + filters are intentionally simple — the booking volume is low
 * (a few per week, max), so we don't need cursor-based pagination or trgm
 * indexes here.
 */

import { bookingDb } from "./client";
import type {
  AvailabilityOverride,
  Booking,
  BookingAuditEntry,
  EventType,
  Host,
  OauthToken,
  Poll,
  PollOption,
  PollResponse,
  PollResponseChoice,
  PollOptionTally,
} from "./types";

// ── hosts ─────────────────────────────────────────────────────────

export async function listHosts(opts: { activeOnly?: boolean } = {}): Promise<Host[]> {
  let q = bookingDb.from("hosts").select("*").order("display_name", { ascending: true });
  if (opts.activeOnly !== false) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw new Error(`[booking/hosts] ${error.message}`);
  return (data ?? []) as Host[];
}

export async function getHostBySlug(slug: string): Promise<Host | null> {
  const { data, error } = await bookingDb
    .from("hosts")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`[booking/hosts] ${error.message}`);
  return (data ?? null) as Host | null;
}

export async function getHostByEmail(email: string): Promise<Host | null> {
  const { data, error } = await bookingDb
    .from("hosts")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error(`[booking/hosts] ${error.message}`);
  return (data ?? null) as Host | null;
}

// ── oauth tokens (status only — never expose ciphertexts in UI) ──

export interface ConnectionStatus {
  hostId: string;
  connected: boolean;
  googleEmail: string | null;
  scope: string | null;
  updatedAt: string | null;
}

export async function listConnectionStatuses(): Promise<ConnectionStatus[]> {
  const hosts = await listHosts();
  const { data: tokens, error } = await bookingDb
    .from("oauth_tokens")
    .select("host_id, refresh_token_ct, scope, google_account_email, updated_at");
  if (error) throw new Error(`[booking/oauth_tokens] ${error.message}`);
  const byHost = new Map(((tokens ?? []) as Partial<OauthToken>[]).map((t) => [t.host_id!, t]));
  return hosts.map((h) => {
    const t = byHost.get(h.id);
    return {
      hostId: h.id,
      connected: Boolean(t?.refresh_token_ct),
      googleEmail: t?.google_account_email ?? null,
      scope: t?.scope ?? null,
      updatedAt: t?.updated_at ?? null,
    };
  });
}

// ── event types ──────────────────────────────────────────────────

export async function listEventTypes(opts: { activeOnly?: boolean } = {}): Promise<EventType[]> {
  let q = bookingDb.from("event_types").select("*").order("slug", { ascending: true });
  if (opts.activeOnly !== false) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw new Error(`[booking/event_types] ${error.message}`);
  return (data ?? []) as EventType[];
}

// ── bookings ─────────────────────────────────────────────────────

export interface BookingFilters {
  hostId?: string;
  eventTypeId?: string;
  status?: Booking["status"];
  /** ISO timestamp — bookings whose `during` lower bound is at or after this. */
  fromIso?: string;
  /** ISO timestamp — bookings whose `during` lower bound is before this. */
  untilIso?: string;
  search?: string;
}

export async function listBookings(
  filters: BookingFilters = {},
  opts: { limit?: number } = {},
): Promise<Booking[]> {
  let q = bookingDb
    .from("bookings")
    .select("*")
    .order("during", { ascending: true })
    .limit(opts.limit ?? 200);

  if (filters.hostId) {
    q = q.or(`assigned_host_id.eq.${filters.hostId},collective_host_ids.cs.{${filters.hostId}}`);
  }
  if (filters.eventTypeId) q = q.eq("event_type_id", filters.eventTypeId);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.search) {
    q = q.or(
      `visitor_name.ilike.%${filters.search}%,visitor_email.ilike.%${filters.search}%`,
    );
  }

  const { data, error } = await q;
  if (error) throw new Error(`[booking/bookings] ${error.message}`);

  // Time-window filter is JS-side: PostgREST doesn't expose gte/lt on tstzrange,
  // and the booking volume is small enough (max ~200) that this is fine.
  let rows = (data ?? []) as Booking[];
  if (filters.fromIso || filters.untilIso) {
    const fromMs = filters.fromIso ? new Date(filters.fromIso).getTime() : -Infinity;
    const untilMs = filters.untilIso ? new Date(filters.untilIso).getTime() : Infinity;
    rows = rows.filter((b) => {
      try {
        const { start } = parseTstzrangeLiteral(b.during);
        const t = start.getTime();
        return t >= fromMs && t < untilMs;
      } catch {
        return true;
      }
    });
  }
  return rows;
}

function parseTstzrangeLiteral(literal: string): { start: Date; end: Date } {
  const m = literal.match(/^[\[(]"?([^,"]+)"?,"?([^)\]"]+)"?[)\]]$/);
  if (!m) throw new Error(`invalid tstzrange: ${literal}`);
  return {
    start: new Date(m[1].trim().replace(" ", "T")),
    end: new Date(m[2].trim().replace(" ", "T")),
  };
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const { data, error } = await bookingDb
    .from("bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`[booking/bookings] ${error.message}`);
  return (data ?? null) as Booking | null;
}

export async function getAuditForBooking(bookingId: string): Promise<BookingAuditEntry[]> {
  const { data, error } = await bookingDb
    .from("booking_audit")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`[booking/audit] ${error.message}`);
  return (data ?? []) as BookingAuditEntry[];
}

// ── availability overrides ───────────────────────────────────────

export async function listOverridesForHost(hostId: string): Promise<AvailabilityOverride[]> {
  const { data, error } = await bookingDb
    .from("availability_overrides")
    .select("*")
    .eq("host_id", hostId)
    .order("during", { ascending: true });
  if (error) throw new Error(`[booking/overrides] ${error.message}`);
  return (data ?? []) as AvailabilityOverride[];
}

// ── polls ─────────────────────────────────────────────────────────

export async function listPolls(): Promise<Poll[]> {
  const { data, error } = await bookingDb
    .from("polls")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`[booking/polls] ${error.message}`);
  return (data ?? []) as Poll[];
}

export interface PollWithMeta extends Poll {
  responseCount: number;
  allOptionsPast: boolean;
}

export async function listPollsWithCounts(): Promise<PollWithMeta[]> {
  const [pollsResult, responsesResult, optionsResult] = await Promise.all([
    bookingDb.from("polls").select("*").order("created_at", { ascending: false }),
    bookingDb.from("poll_responses").select("poll_id"),
    bookingDb.from("poll_options").select("poll_id, ends_at"),
  ]);
  if (pollsResult.error) throw new Error(`[booking/polls] ${pollsResult.error.message}`);

  const responseCountMap = new Map<string, number>();
  for (const r of (responsesResult.data ?? [])) {
    responseCountMap.set(r.poll_id, (responseCountMap.get(r.poll_id) ?? 0) + 1);
  }

  const optionsByPoll = new Map<string, string[]>();
  for (const o of (optionsResult.data ?? [])) {
    if (!optionsByPoll.has(o.poll_id)) optionsByPoll.set(o.poll_id, []);
    optionsByPoll.get(o.poll_id)!.push(o.ends_at);
  }

  const now = Date.now();
  return (pollsResult.data ?? []).map((poll) => {
    const responseCount = responseCountMap.get(poll.id) ?? 0;
    const ends = optionsByPoll.get(poll.id) ?? [];
    const allOptionsPast =
      ends.length > 0 && ends.every((e) => new Date(e).getTime() < now);
    return { ...poll, responseCount, allOptionsPast } as PollWithMeta;
  });
}

export async function getPollBySlug(slug: string): Promise<Poll | null> {
  const { data, error } = await bookingDb
    .from("polls")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`[booking/polls] ${error.message}`);
  return (data ?? null) as Poll | null;
}

export async function getPollById(id: string): Promise<Poll | null> {
  const { data, error } = await bookingDb
    .from("polls")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`[booking/polls] ${error.message}`);
  return (data ?? null) as Poll | null;
}

export async function listPollOptions(pollId: string): Promise<PollOption[]> {
  const { data, error } = await bookingDb
    .from("poll_options")
    .select("*")
    .eq("poll_id", pollId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`[booking/poll_options] ${error.message}`);
  return (data ?? []) as PollOption[];
}

export async function getPollResults(pollId: string): Promise<{
  responses: PollResponse[];
  choices: PollResponseChoice[];
}> {
  const { data: responses, error: rErr } = await bookingDb
    .from("poll_responses")
    .select("*")
    .eq("poll_id", pollId)
    .order("created_at", { ascending: true });
  if (rErr) throw new Error(`[booking/poll_responses] ${rErr.message}`);

  const responseIds = (responses ?? []).map((r) => (r as PollResponse).id);
  if (responseIds.length === 0) {
    return { responses: [], choices: [] };
  }

  const { data: choices, error: cErr } = await bookingDb
    .from("poll_response_choices")
    .select("*")
    .in("response_id", responseIds);
  if (cErr) throw new Error(`[booking/poll_response_choices] ${cErr.message}`);

  return {
    responses: (responses ?? []) as PollResponse[],
    choices: (choices ?? []) as PollResponseChoice[],
  };
}

/** Computes per-slot tallies from raw responses + choices. Pure function — no DB call. */
export function computeTallies(
  options: PollOption[],
  responses: PollResponse[],
  choices: PollResponseChoice[],
): PollOptionTally[] {
  const responseById = new Map(responses.map((r) => [r.id, r]));
  const choicesByOption = new Map<string, PollResponseChoice[]>();
  for (const opt of options) choicesByOption.set(opt.id, []);
  for (const c of choices) {
    const list = choicesByOption.get(c.option_id);
    if (list) list.push(c);
  }

  const tallies = options.map((opt) => {
    const optChoices = choicesByOption.get(opt.id) ?? [];
    let yes = 0, if_need_be = 0, no = 0;
    const respondents: PollOptionTally["respondents"] = [];
    for (const c of optChoices) {
      if (c.availability === "yes") yes++;
      else if (c.availability === "if_need_be") if_need_be++;
      else no++;
      const resp = responseById.get(c.response_id);
      if (resp) respondents.push({ name: resp.respondent_name, availability: c.availability });
    }
    return { option: opt, yes, if_need_be, no, respondents, isBest: false };
  });

  // best slot = highest yes count, then yes+if_need_be as tiebreaker
  if (tallies.length > 0) {
    const best = tallies.reduce((a, b) =>
      b.yes > a.yes || (b.yes === a.yes && b.if_need_be > a.if_need_be) ? b : a,
    );
    if (best.yes + best.if_need_be > 0) best.isBest = true;
  }

  return tallies;
}
