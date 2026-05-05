/**
 * In-memory per-instance cache for hot-path read-mostly data.
 *
 * Vercel Fluid Compute reuses function instances across concurrent
 * requests, so a process-local Map persists across invocations on a
 * warm instance. Cold-start fetches still pay the Notion roundtrip;
 * subsequent ones within `ttlMs` hit memory.
 *
 * Bypass: pass `{ skipCache: true }` to force a fresh fetch (useful
 * for tests and post-write reads).
 */
const _store = new Map();

export async function memoize(key, ttlMs, loader, opts = {}) {
  const now = Date.now();
  if (!opts.skipCache) {
    const hit = _store.get(key);
    if (hit && hit.expiresAt > now) return hit.value;
  }
  const value = await loader();
  _store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function invalidate(key) {
  _store.delete(key);
}

export function invalidatePrefix(prefix) {
  for (const k of _store.keys()) {
    if (k.startsWith(prefix)) _store.delete(k);
  }
}
