/**
 * Google Calendar free/busy fetcher with edge caching.
 *
 * Uses freeBusy.query — a single API call can return busy windows for up
 * to 50 calendars over a date range. Each host's primary calendar is
 * resolved via `calendarId='primary'` while authenticated as that host.
 *
 * Edge cache: Cloudflare Workers' caches.default with a 60-second TTL on
 * the response, keyed on (hostId, range). This kills ~95% of the Google
 * API hits during a popular slot-loading period.
 */

import { getValidAccessTokenForHost } from "./google-oauth";

export interface Interval {
  start: Date;
  end: Date;
}

export interface HostBusy {
  hostId: string;
  busy: Interval[];
  fetched_at: number;
  error?: string;
}

const FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy";
const CACHE_TTL_SEC = 60;

interface FreeBusyApiResponse {
  calendars: Record<string, { busy?: { start: string; end: string }[]; errors?: { reason: string }[] }>;
}

/**
 * Fetch busy intervals for one host over [from, to). Cached at the edge
 * for CACHE_TTL_SEC seconds. Returns empty `busy` (and an `error` string)
 * if the host's token is broken — slots will simply show "no availability"
 * for that host until reconnect.
 */
export async function getFreeBusyForHost(
  hostId: string,
  from: Date,
  to: Date,
): Promise<HostBusy> {
  // Cache key: include the calendar minute granularity so two requests
  // within 60s of each other (the common case for slot-page rendering)
  // hit the same cache entry.
  const cacheKey = makeCacheKey(hostId, from, to);

  // CF Workers expose `caches.default`; in Node/local dev it may not exist.
  const cache: Cache | undefined = typeof caches !== "undefined" ? caches.default : undefined;

  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) {
      const data = (await hit.json()) as { busy: { start: string; end: string }[]; error?: string };
      return {
        hostId,
        busy: data.busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) })),
        fetched_at: Date.now(),
        error: data.error,
      };
    }
  }

  let busy: Interval[] = [];
  let errorMsg: string | undefined;

  try {
    const accessToken = await getValidAccessTokenForHost(hostId);
    const res = await fetch(FREEBUSY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        items: [{ id: "primary" }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      errorMsg = `freeBusy ${res.status}: ${errText.slice(0, 200)}`;
    } else {
      const data = (await res.json()) as FreeBusyApiResponse;
      const cal = data.calendars?.primary ?? data.calendars?.[Object.keys(data.calendars ?? {})[0]];
      if (cal?.errors && cal.errors.length > 0) {
        errorMsg = `freeBusy errors: ${cal.errors.map((e) => e.reason).join(", ")}`;
      } else {
        busy = (cal?.busy ?? []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
      }
    }
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : String(e);
  }

  // Write to cache (best-effort)
  if (cache) {
    const body = JSON.stringify({
      busy: busy.map((b) => ({ start: b.start.toISOString(), end: b.end.toISOString() })),
      error: errorMsg,
    });
    const cachedRes = new Response(body, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_TTL_SEC}`,
      },
    });
    await cache.put(cacheKey, cachedRes);
  }

  return { hostId, busy, fetched_at: Date.now(), error: errorMsg };
}

/**
 * Fetch busy intervals for multiple hosts in parallel. One Google API call
 * per host (since each is authenticated separately).
 */
export async function getFreeBusyForHosts(
  hostIds: string[],
  from: Date,
  to: Date,
): Promise<HostBusy[]> {
  return Promise.all(hostIds.map((id) => getFreeBusyForHost(id, from, to)));
}

function makeCacheKey(hostId: string, from: Date, to: Date): Request {
  // Round to the minute so cache entries are stable across rapid requests.
  const fromKey = roundToMinute(from).toISOString();
  const toKey = roundToMinute(to).toISOString();
  // Synthetic URL — cache.match() requires a Request/URL key on Workers.
  const url = `https://internal.windedvertigo/booking/freebusy?h=${encodeURIComponent(hostId)}&f=${fromKey}&t=${toKey}`;
  return new Request(url);
}

function roundToMinute(d: Date): Date {
  const ms = d.getTime();
  return new Date(ms - (ms % 60_000));
}

// Augment global type so TS knows about caches.default on CF Workers.
declare global {
  interface CacheStorage {
    readonly default: Cache;
  }
}
