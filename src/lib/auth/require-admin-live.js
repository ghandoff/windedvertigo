/**
 * Wave 7.0.1 — Live admin re-verification.
 *
 * The JWT carries `isAdmin` at sign-time. If an admin is demoted in Notion,
 * their JWT keeps `isAdmin: true` until expiry — which means any route that
 * trusts the stale claim (e.g. `src/app/api/scores/route.js`, admin exports,
 * backfills) continues to grant admin powers long after the revocation.
 *
 * This helper closes that gap by re-reading the Reviewer row from Notion on
 * every admin-gated server request. To avoid hammering Notion under burst
 * traffic we maintain a per-process in-memory cache with a 30-second TTL.
 *
 * Trade-offs (documented deliberately):
 *   - 30s cache: a revoked admin retains access for up to 30s after the
 *     change lands in Notion. Acceptable vs. hitting Notion on every call.
 *   - Fail closed: if the Notion lookup throws, return 503 rather than
 *     falling back to the JWT claim. Better to lock admins out briefly
 *     than let stale claims through during an outage.
 *
 * Usage (replaces `const isAdmin = await verifyAdminFromNotion(user)` +
 * manual 403 return):
 *
 *     const gate = await requireAdminLive(request);
 *     if (gate.error) return gate.error;
 *     const { user } = gate;
 */

import { NextResponse } from 'next/server';
import { authenticateRequest } from '../auth.js';

const CACHE_TTL_MS = 30_000;

/**
 * In-memory cache: reviewerId → { isAdmin: boolean, roles: string[], expiresAt: number }
 * Per-process — fine for our scale, no external dep.
 */
const liveAdminCache = new Map();

function readCache(reviewerId) {
  const entry = liveAdminCache.get(reviewerId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    liveAdminCache.delete(reviewerId);
    return null;
  }
  return entry;
}

function writeCache(reviewerId, value) {
  liveAdminCache.set(reviewerId, { ...value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * For tests or post-revocation invalidation. Not exported from index —
 * intentionally internal-only unless needed.
 */
export function _clearLiveAdminCache(reviewerId) {
  if (reviewerId) liveAdminCache.delete(reviewerId);
  else liveAdminCache.clear();
}

/**
 * Authenticate a request AND confirm the user is still an admin in Notion.
 *
 * Returns `{ user }` on success or `{ error: NextResponse }` on failure.
 * The returned `user` carries Notion-live `roles` (not stale JWT roles).
 *
 * Status codes:
 *   401 — no/invalid JWT
 *   403 — authenticated but admin revoked (or never was)
 *   503 — Notion lookup failed (fail closed)
 */
export async function requireAdminLive(request, { route } = {}) {
  const user = await authenticateRequest(request);
  if (!user) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }
  if (!user.reviewerId) {
    return { error: NextResponse.json({ error: 'Invalid session' }, { status: 403 }) };
  }

  // Cache hit? Use it.
  const cached = readCache(user.reviewerId);
  if (cached) {
    if (!cached.isAdmin) {
      logRevocationBreadcrumb({ user, liveIsAdmin: false, route, source: 'cache' });
      return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
    }
    return { user: { ...user, roles: cached.roles } };
  }

  // Cache miss — re-read from Notion.
  let reviewer;
  try {
    const { getReviewerById } = await import('@/lib/notion');
    reviewer = await getReviewerById(user.reviewerId);
  } catch (err) {
    // Fail closed. See module docblock.
    console.error('[requireAdminLive] Notion lookup failed:', err?.message || err);
    return {
      error: NextResponse.json(
        { error: 'Authorization check failed. Please retry.' },
        { status: 503 }
      ),
    };
  }

  if (!reviewer) {
    writeCache(user.reviewerId, { isAdmin: false, roles: [] });
    logRevocationBreadcrumb({ user, liveIsAdmin: false, route, source: 'notion', reason: 'reviewer-not-found' });
    return { error: NextResponse.json({ error: 'User not found' }, { status: 403 }) };
  }

  const liveIsAdmin = reviewer.isAdmin === true;
  const liveRoles = Array.isArray(reviewer.roles) ? reviewer.roles : [];
  writeCache(user.reviewerId, { isAdmin: liveIsAdmin, roles: liveRoles });

  if (!liveIsAdmin) {
    logRevocationBreadcrumb({ user, liveIsAdmin: false, route, source: 'notion' });
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }

  return { user: { ...user, roles: liveRoles, isAdmin: true } };
}

/**
 * Audit-log breadcrumb for stale-claim mismatches. Today this is just a
 * console log; Wave 7.5 replaces it with a real audit-log sink. Leaving
 * the shape deliberate so the future migration is a body-swap.
 */
function logRevocationBreadcrumb({ user, liveIsAdmin, route, source, reason }) {
  // Only log when the JWT claim DISAGREES with the live value — this is the
  // interesting signal (stale admin claim). Skip the common case where the
  // JWT already says !isAdmin and live confirms !isAdmin.
  const jwtIsAdmin = user?.isAdmin === true;
  if (jwtIsAdmin === liveIsAdmin) return;
  try {
    console.warn('[audit:admin-revocation]', JSON.stringify({
      ts: new Date().toISOString(),
      alias: user?.alias || null,
      reviewerId: user?.reviewerId || null,
      route: route || null,
      jwtIsAdmin,
      liveIsAdmin,
      source: source || 'unknown',
      reason: reason || null,
    }));
  } catch {
    // no-op — audit logging must never break the request.
  }
}
