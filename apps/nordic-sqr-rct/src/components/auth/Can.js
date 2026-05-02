'use client';

/**
 * Wave 7.1 — client-side capability gate.
 *
 * Wraps children and renders them only when the current user holds
 * `capability`. Falls back to `fallback` (default: null) otherwise.
 *
 * This is UX-only. Every privileged server action must still re-check
 * via `requireCapability` (src/lib/auth/require-capability.js). Never
 * trust the absence of `<Can>` as security — stale JWT claims make it
 * an insufficient boundary.
 *
 * Usage:
 *   <Can capability="pcs.imports:run" fallback={<DisabledRunBtn />}>
 *     <RunImportButton />
 *   </Can>
 */

import { useAuth } from '@/lib/useAuth';
import { can } from '@/lib/auth/capabilities';

export default function Can({ capability, children, fallback = null }) {
  const { user } = useAuth();
  if (!can(user, capability)) return fallback;
  return children;
}
