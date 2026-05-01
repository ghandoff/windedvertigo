/**
 * Persistent rate limiter — Postgres-backed sliding window counter.
 *
 * Session 12: replaces the in-memory token bucket that reset on cold
 * starts and didn't share state across Vercel serverless instances.
 *
 * How it works:
 *   1. Each API request is bucketed into a 1-minute window (truncated
 *      to the start of the minute).
 *   2. An UPSERT increments the hit counter for (key, window_start)
 *      and returns the current count in one round-trip.
 *   3. If the count exceeds the limit, the request is rejected (429).
 *   4. A lightweight prune runs inline every ~5 minutes to delete
 *      windows older than 10 minutes, keeping the table tiny.
 *
 * Performance: one small UPSERT per API request. Neon's serverless
 * driver keeps connection overhead low. The table rarely exceeds a
 * few hundred rows even under moderate traffic.
 *
 * The in-memory fallback is kept as a safety net: if the DB query
 * fails (e.g. Neon is briefly unavailable), we fall back to the
 * original in-memory bucket so the API stays responsive rather than
 * hard-failing every request.
 */

import { sql } from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  config                                                             */
/* ------------------------------------------------------------------ */

const WINDOW_MS = 60_000; // 1-minute window
const PRUNE_INTERVAL_MS = 5 * 60_000; // prune every 5 minutes
const PRUNE_AGE_MS = 10 * 60_000; // delete windows older than 10 min

let lastPrune = Date.now();

/* ------------------------------------------------------------------ */
/*  in-memory fallback (kept from original proxy.ts)                   */
/* ------------------------------------------------------------------ */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const memBuckets = new Map<string, Bucket>();

function checkMemoryFallback(key: string, limit: number): boolean {
  const now = Date.now();
  let bucket = memBuckets.get(key);

  if (!bucket) {
    bucket = { tokens: limit - 1, lastRefill: now };
    memBuckets.set(key, bucket);
    return true;
  }

  const elapsed = now - bucket.lastRefill;
  if (elapsed >= WINDOW_MS) {
    bucket.tokens = limit - 1;
    bucket.lastRefill = now;
    return true;
  }

  if (bucket.tokens > 0) {
    bucket.tokens--;
    return true;
  }

  return false;
}

// Clean stale in-memory buckets
let lastMemCleanup = Date.now();
function cleanupMemBuckets() {
  const now = Date.now();
  if (now - lastMemCleanup < PRUNE_INTERVAL_MS) return;
  lastMemCleanup = now;
  for (const [key, bucket] of memBuckets) {
    if (now - bucket.lastRefill > PRUNE_AGE_MS) {
      memBuckets.delete(key);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  persistent check (Postgres)                                        */
/* ------------------------------------------------------------------ */

/**
 * Check and record a rate limit hit. Returns true if allowed, false
 * if the limit has been exceeded for this window.
 *
 * On DB failure, falls back to the in-memory bucket silently.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
): Promise<boolean> {
  try {
    // Truncate to the start of the current 1-minute window
    // Using date_trunc('minute', ...) gives us a clean window boundary.
    const result = await sql.query(
      `INSERT INTO rate_limits (key, window_start, hits)
       VALUES ($1, date_trunc('minute', now()), 1)
       ON CONFLICT (key, window_start)
       DO UPDATE SET hits = rate_limits.hits + 1
       RETURNING hits`,
      [key],
    );

    const hits = result.rows[0]?.hits ?? 1;

    // Fire-and-forget prune of old windows
    maybePrune();

    return hits <= limit;
  } catch (err) {
    // DB unavailable — fall back to in-memory so API stays up
    // Log once per minute to avoid spam.
    // (Console.warn is fine here — Vercel captures it in function logs.)
    console.warn("[rate-limit] DB fallback:", (err as Error).message);
    cleanupMemBuckets();
    return checkMemoryFallback(key, limit);
  }
}

/* ------------------------------------------------------------------ */
/*  prune old windows                                                  */
/* ------------------------------------------------------------------ */

function maybePrune() {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;

  // Fire-and-forget — don't await, don't block the response
  sql
    .query(
      `DELETE FROM rate_limits WHERE window_start < now() - interval '10 minutes'`,
    )
    .catch((err) => {
      console.warn("[rate-limit] prune failed:", (err as Error).message);
    });
}
