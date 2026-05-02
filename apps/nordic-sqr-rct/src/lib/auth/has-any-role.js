/**
 * Wave 7.0.2 — Shared role-check helper.
 *
 * Eliminates the copy-pasted `user?.roles?.includes('pcs') || ... || user?.isAdmin`
 * ternary that was scattered across ~6 files (PcsNav, pcs/data/page, Navbar,
 * CommentThread, LivingPcsView, claims/[id]/*, evidence/*, documents/[id]).
 *
 * Resolution rules (matches prior behavior exactly):
 *   1. If `user.roles` is a non-empty array, use it directly.
 *   2. Else, fall back to `user.isAdmin ? ['sqr-rct','pcs','admin'] : []`.
 *   3. Intersect against the requested role set.
 *
 * NOTE: this helper is for UX/nav gating. Server-side authorization must
 * still go through `authenticatePcsWrite` or `requireAdminLive` — stale
 * JWT claims can't be trusted for privilege-sensitive work.
 */

const LEGACY_ADMIN_FALLBACK = ['sqr-rct', 'pcs', 'admin'];

/**
 * Resolve the effective roles for a user object, honoring the legacy
 * `isAdmin` boolean fallback used by pre-roles-array JWTs.
 */
export function resolveRoles(user) {
  if (Array.isArray(user?.roles) && user.roles.length > 0) return user.roles;
  if (user?.isAdmin) return LEGACY_ADMIN_FALLBACK;
  return [];
}

/**
 * Return true iff the user has at least one role in `roles`.
 * @param {{ roles?: string[], isAdmin?: boolean } | null | undefined} user
 * @param {string[]} roles
 */
export function hasAnyRole(user, roles) {
  if (!Array.isArray(roles) || roles.length === 0) return false;
  const effective = resolveRoles(user);
  if (effective.length === 0) return false;
  return roles.some(r => effective.includes(r));
}

/**
 * Pre-defined role constellations used across the app.
 * Keeping these centralized means a role-model change (e.g. adding `researcher`
 * in Wave 7.1.4) is a one-file edit.
 */
export const ROLE_SETS = Object.freeze({
  // Read-or-write PCS access (includes pcs-readonly). Matches hasPcsAccess.
  PCS_ANY:        ['pcs', 'pcs-readonly', 'admin'],
  // PCS writers only (no readonly).
  PCS_WRITERS:    ['pcs', 'admin'],
  // Legacy "internal Nordic user" mix used by the old fallback ternary.
  PCS_OR_RCT:     ['sqr-rct', 'pcs', 'pcs-readonly', 'admin'],
  // SQR-RCT score reviewers.
  SQR_REVIEWERS:  ['sqr-rct', 'admin'],
  // Admin-only (UX hint — server must re-verify via requireAdminLive).
  ADMIN_ONLY:     ['admin'],
});
