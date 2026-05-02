/**
 * Wave 7.1 — server-side capability guard.
 *
 * `requireCapability(request, capabilityKey)` is the new server auth primitive.
 * It authenticates the JWT, optionally re-verifies against live Notion state
 * for super-user-only capabilities, checks `can()`, and returns the user on
 * success or a 401/403/503 NextResponse on failure.
 *
 * Return shape matches `requireAdminLive` / the existing `authenticatePcs*`
 * helpers so routes can migrate one at a time:
 *
 *     const gate = await requireCapability(request, 'pcs.claims:author');
 *     if (gate.error) return gate.error;
 *     const { user } = gate;
 *
 * This is ADDITIVE — existing `authenticatePcsRead/Write` helpers keep
 * working unchanged. Migration to this function happens per-route in
 * Wave 7.5, not here.
 */

import { NextResponse } from 'next/server';
import { authenticateRequest } from '../auth.js';
import { can, SUPER_USER_ONLY_CAPABILITIES } from './capabilities.js';
import { requireAdminLive } from './require-admin-live.js';

/**
 * @param {Request} request
 * @param {string} capability  capability key, e.g. 'pcs.claims:author'
 * @param {{ route?: string }} [opts]
 * @returns {Promise<{ user: object } | { error: Response }>}
 */
export async function requireCapability(request, capability, opts = {}) {
  if (typeof capability !== 'string' || capability.length === 0) {
    return {
      error: NextResponse.json(
        { error: 'invalid-capability', required: String(capability) },
        { status: 500 }
      ),
    };
  }

  // Super-user-only capabilities require live Notion re-verification.
  // Delegating to `requireAdminLive` preserves the "write = re-check" posture
  // from Wave 7.0.1. Note: today `requireAdminLive` only verifies `isAdmin`.
  // When Wave 7.1.4 introduces the explicit `super-user` role, this branch
  // will distinguish admin vs. super-user; for now a super-user-only cap
  // means "at minimum must be live-admin in Notion" and the capability
  // check below still gates on the actual role set.
  if (SUPER_USER_ONLY_CAPABILITIES.has(capability)) {
    const gate = await requireAdminLive(request, { route: opts.route });
    if (gate.error) return gate;
    if (!can(gate.user, capability)) {
      return {
        error: NextResponse.json(
          { error: 'missing-capability', required: capability },
          { status: 403 }
        ),
      };
    }
    return { user: gate.user };
  }

  // Standard path: authenticate the JWT and check the capability against
  // whatever roles it carries. This is the same trust model as
  // `authenticatePcsWrite` today — stale roles are tolerated for non-
  // super-user work.
  const user = await authenticateRequest(request);
  if (!user) {
    return {
      error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    };
  }

  if (!can(user, capability)) {
    return {
      error: NextResponse.json(
        { error: 'missing-capability', required: capability },
        { status: 403 }
      ),
    };
  }

  return { user };
}
