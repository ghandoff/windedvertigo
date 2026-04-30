/**
 * Supabase REST client for the booking system.
 *
 * Uses fetch + PostgREST directly (no `@supabase/supabase-js`) to keep the
 * Worker bundle small and avoid Node-only deps. Service role key bypasses
 * RLS — only call from server-side route handlers.
 *
 * Patterns used here mirror Supabase's PostgREST conventions:
 *   GET    /rest/v1/<table>?<filter>      — select
 *   POST   /rest/v1/<table>               — insert
 *   PATCH  /rest/v1/<table>?<filter>      — update
 *   DELETE /rest/v1/<table>?<filter>      — delete
 *   POST   /rest/v1/rpc/<fn>              — call SQL function
 *
 * Errors throw a `SupabaseError` with the PostgREST message and HTTP status.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export class SupabaseError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "SupabaseError";
  }
}

function ensureConfigured(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new SupabaseError("Supabase not configured (SUPABASE_URL/SERVICE_ROLE_KEY missing)", 500);
  }
  return { url: SUPABASE_URL, key: SUPABASE_SERVICE_ROLE_KEY };
}

interface RequestOptions {
  prefer?: string; // e.g. "return=representation" or "resolution=merge-duplicates"
  signal?: AbortSignal;
}

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const { url, key } = ensureConfigured();
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.prefer) headers["Prefer"] = opts.prefer;

  const res = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: opts.signal,
  });

  // 204 No Content → return null
  if (res.status === 204) return null as T;

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const errObj =
      typeof data === "object" && data !== null
        ? (data as { message?: string; code?: string; details?: unknown; hint?: string })
        : {};
    throw new SupabaseError(
      errObj.message || `Supabase ${method} ${path} failed (${res.status})`,
      res.status,
      errObj.code,
      errObj.details ?? errObj.hint,
    );
  }

  return data as T;
}

/**
 * Select rows. Returns array (PostgREST default).
 *
 * Example:
 *   const hosts = await select<Host>('hosts', { active: 'eq.true' });
 *   const hosts = await select<Host>('hosts', 'slug=eq.garrett&select=*');
 */
export function select<T>(
  table: string,
  filter: Record<string, string> | string = "",
  opts?: RequestOptions,
): Promise<T[]> {
  const qs =
    typeof filter === "string"
      ? filter
      : Object.entries(filter)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join("&");
  const path = `/rest/v1/${table}${qs ? `?${qs}` : ""}`;
  return request<T[]>("GET", path, undefined, opts);
}

/** Select one row, or null if none. Throws if multiple match. */
export async function selectOne<T>(
  table: string,
  filter: Record<string, string> | string = "",
  opts?: RequestOptions,
): Promise<T | null> {
  const rows = await select<T>(table, filter, {
    ...opts,
    prefer: "count=exact",
  });
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    throw new SupabaseError(`selectOne(${table}) returned ${rows.length} rows`, 500);
  }
  return rows[0];
}

/**
 * Insert row(s). Returns inserted row(s) when prefer=return=representation.
 *
 * Example:
 *   const [host] = await insert<Host>('hosts', { slug: 'garrett', ... });
 */
export function insert<T>(
  table: string,
  rows: Record<string, unknown> | Record<string, unknown>[],
  opts?: RequestOptions,
): Promise<T[]> {
  return request<T[]>("POST", `/rest/v1/${table}`, rows, {
    ...opts,
    prefer: opts?.prefer ?? "return=representation",
  });
}

/** Upsert row(s) keyed on a column (default: primary key). */
export function upsert<T>(
  table: string,
  rows: Record<string, unknown> | Record<string, unknown>[],
  onConflict?: string,
  opts?: RequestOptions,
): Promise<T[]> {
  const path = onConflict
    ? `/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`
    : `/rest/v1/${table}`;
  return request<T[]>("POST", path, rows, {
    ...opts,
    prefer: opts?.prefer ?? "resolution=merge-duplicates,return=representation",
  });
}

/**
 * Update rows matching filter.
 *
 * Example:
 *   await update<Booking>('bookings', { id: 'eq.' + bookingId }, { status: 'cancelled' });
 */
export function update<T>(
  table: string,
  filter: Record<string, string> | string,
  patch: Record<string, unknown>,
  opts?: RequestOptions,
): Promise<T[]> {
  const qs =
    typeof filter === "string"
      ? filter
      : Object.entries(filter)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join("&");
  return request<T[]>("PATCH", `/rest/v1/${table}?${qs}`, patch, {
    ...opts,
    prefer: opts?.prefer ?? "return=representation",
  });
}

/** Delete rows matching filter. Returns deleted rows when prefer=return=representation. */
export function remove<T>(
  table: string,
  filter: Record<string, string> | string,
  opts?: RequestOptions,
): Promise<T[]> {
  const qs =
    typeof filter === "string"
      ? filter
      : Object.entries(filter)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join("&");
  return request<T[]>("DELETE", `/rest/v1/${table}?${qs}`, undefined, {
    ...opts,
    prefer: opts?.prefer ?? "return=representation",
  });
}

/**
 * Call a stored procedure (e.g. book_round_robin).
 *
 * Example:
 *   const booking = await rpc<Booking>('book_round_robin', { p_event_type_id, p_during, ... });
 */
export function rpc<T>(
  fn: string,
  args: Record<string, unknown> = {},
  opts?: RequestOptions,
): Promise<T> {
  return request<T>("POST", `/rest/v1/rpc/${fn}`, args, opts);
}

// ── shared row types ─────────────────────────────────────────────

export interface Host {
  id: string;
  slug: string;
  display_name: string;
  email: string;
  timezone: string;
  working_hours: Record<string, [string, string][]>;
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

export type EventTypeMode = "solo" | "collective" | "round_robin";

export interface EventType {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_min: number;
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
  during: string; // tstzrange literal e.g. '["2026-05-01 17:00:00+00","2026-05-01 17:30:00+00")'
  visitor_name: string;
  visitor_email: string;
  visitor_tz: string;
  intake: Record<string, unknown> | null;
  google_event_id: string | null;
  meet_url: string | null;
  status: "confirmed" | "cancelled" | "rescheduled";
  created_at: string;
  cancelled_at: string | null;
}

export interface AvailabilityOverride {
  id: string;
  host_id: string;
  during: string;
  kind: "block" | "extra";
  reason: string | null;
}

/**
 * Format a JS Date pair as a Postgres tstzrange literal `[start, end)`.
 * Always half-open (lower-inclusive, upper-exclusive) to match
 * the convention used in slot generation.
 */
export function tstzrange(start: Date, end: Date): string {
  return `[${start.toISOString()},${end.toISOString()})`;
}

/**
 * Parse a Postgres tstzrange literal into a JS Date pair.
 * Tolerates both ISO and Postgres timestamp formats.
 */
export function parseTstzrange(literal: string): { start: Date; end: Date } {
  const m = literal.match(/^[\[(]([^,]+),([^)\]]+)[)\]]$/);
  if (!m) throw new SupabaseError(`invalid tstzrange: ${literal}`, 500);
  return {
    start: new Date(m[1].trim().replace(" ", "T")),
    end: new Date(m[2].trim().replace(" ", "T")),
  };
}
