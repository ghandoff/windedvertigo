/**
 * Rate limiter backed by Cloudflare Workers KV (SESSION_KV binding).
 *
 * In-memory Map limiters don't survive across Workers isolates — every
 * region/cold-start gets its own counter, defeating the cap. KV is the
 * cheapest distributed-state mechanism we have on CF Workers and the
 * SESSION_KV namespace is already bound (see wrangler.jsonc).
 *
 * Pattern:
 *   key  = `rl:${bucket}:${id}` e.g. `rl:book:create:visitor@example.com`
 *   value = JSON {count, resetAt}
 *   ttl   = bucket window in seconds (auto-expires keys, no GC needed)
 *
 * Two limit dimensions used by the create route:
 *   - per-email daily cap: 5 bookings per email per 24h
 *   - global hourly cap:   100 bookings per hour across all visitors
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // unix ms
}

// CF Workers binding shape — accessed via process.env in OpenNext bridge.
// In Next.js Server Components / route handlers under OpenNext, the KV
// binding is exposed via getRequestContext().env.SESSION_KV. We import
// lazily to avoid breaking local dev where that binding isn't available.
interface KVNamespace {
  get(key: string, options?: { type: "text" }): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

async function getKv(): Promise<KVNamespace | null> {
  try {
    // OpenNext exposes Cloudflare bindings via this helper when running on Workers.
    const mod = await import("@opennextjs/cloudflare").catch(() => null);
    if (!mod) return null;
    const ctx = (mod as unknown as {
      getCloudflareContext: () => { env: { SESSION_KV?: KVNamespace } };
    }).getCloudflareContext();
    return ctx?.env?.SESSION_KV ?? null;
  } catch {
    return null;
  }
}

interface RateLimitOptions {
  /** Logical bucket name, e.g. 'book:create' or 'book:create:global' */
  bucket: string;
  /** Subject of the limit (email, IP, or 'global') */
  id: string;
  /** Max requests permitted within the window */
  limit: number;
  /** Window length in seconds */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  resetAt: number;
  limit: number;
  /** When KV is unavailable (local dev, missing binding) we fail open */
  degraded?: boolean;
}

/**
 * Increment-and-check. Returns whether this request is within the limit.
 *
 * If KV is unavailable we fail open (allowed=true, degraded=true) so that
 * local dev / missing-binding scenarios don't break the booking flow.
 * In production, Cloudflare KV has high availability — set up alerting
 * on degraded=true to detect misconfigurations.
 */
export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const kv = await getKv();
  const key = `rl:${opts.bucket}:${opts.id}`;
  const now = Date.now();

  if (!kv) {
    return { allowed: true, count: 0, resetAt: now + opts.windowSec * 1000, limit: opts.limit, degraded: true };
  }

  let entry: RateLimitEntry = { count: 0, resetAt: now + opts.windowSec * 1000 };
  try {
    const raw = await kv.get(key);
    if (raw) {
      const parsed = JSON.parse(raw) as RateLimitEntry;
      if (parsed.resetAt > now) entry = parsed;
    }
  } catch {
    // Treat read errors as "no entry"
  }

  if (entry.count >= opts.limit) {
    return { allowed: false, count: entry.count, resetAt: entry.resetAt, limit: opts.limit };
  }

  entry.count += 1;

  try {
    const ttl = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    await kv.put(key, JSON.stringify(entry), { expirationTtl: ttl });
  } catch (err) {
    console.warn("[rate-limit-kv] put failed:", String(err));
  }

  return { allowed: true, count: entry.count, resetAt: entry.resetAt, limit: opts.limit };
}

// Pre-configured limiters used by the booking system

export const checkBookingCreateLimit = (visitorEmail: string) =>
  checkRateLimit({
    bucket: "book:create",
    id: visitorEmail.toLowerCase(),
    limit: 5,
    windowSec: 24 * 60 * 60,
  });

export const checkBookingCreateGlobalLimit = () =>
  checkRateLimit({
    bucket: "book:create:global",
    id: "all",
    limit: 100,
    windowSec: 60 * 60,
  });
