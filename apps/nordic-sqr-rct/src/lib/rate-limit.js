/**
 * Lightweight in-memory rate limiter for Vercel serverless functions.
 *
 * Limits are enforced per IP within a single warm instance. This won't
 * persist across cold starts, but it effectively blocks rapid-fire
 * brute-force attempts (the most common attack vector).
 *
 * For cross-instance persistence, upgrade to Upstash Redis or Vercel KV.
 */

const stores = new Map();

/**
 * Create a rate limiter with the given options.
 *
 * @param {object} opts
 * @param {number} opts.maxAttempts - Max requests allowed per window
 * @param {number} opts.windowMs    - Window duration in milliseconds
 * @returns {function(Request): {success: boolean, remaining: number, resetAt: number}}
 */
export function createRateLimiter({ maxAttempts, windowMs }) {
  // Each limiter gets its own store so login / register limits are independent
  const key = `${maxAttempts}:${windowMs}`;
  if (!stores.has(key)) {
    stores.set(key, new Map());
  }
  const store = stores.get(key);

  // Periodically purge expired entries (every 60 s) to prevent memory leaks
  if (!store._cleanupTimer) {
    store._cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [ip, entry] of store) {
        if (now > entry.resetAt) store.delete(ip);
      }
    }, 60_000).unref?.(); // .unref() so the timer doesn't keep Node alive in dev
  }

  return function checkRateLimit(request) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const now = Date.now();
    let entry = store.get(ip);

    // If no entry or window expired, start a new window
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(ip, entry);
    }

    entry.count += 1;

    if (entry.count > maxAttempts) {
      return {
        success: false,
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }

    return {
      success: true,
      remaining: maxAttempts - entry.count,
      resetAt: entry.resetAt,
    };
  };
}
