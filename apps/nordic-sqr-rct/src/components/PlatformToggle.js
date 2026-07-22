'use client';

/**
 * 2026-05-03 — Platform toggle (segmented control).
 *
 * Replaces the two cross-link buttons that previously sat in both
 * PcsNav and Navbar. A single segmented control reclaims horizontal
 * space (the buttons were squishing the Nordic logo on the left).
 *
 * Capability-gated: each pill renders only if the user has the
 * corresponding role set. So:
 *   - A Nordic team member with both PCS + SQR roles sees both pills.
 *   - An external SQR-only reviewer sees only the SQR-RCT pill (and
 *     since they're already on /dashboard, the toggle effectively
 *     becomes a single static label).
 *   - A super-user sees both pills regardless of which platform they
 *     entered through.
 *
 * Hidden on `sm` and below (mobile uses the existing hamburger
 * dropdown for cross-platform navigation as a fallback).
 */

import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';

const PLATFORMS = {
  pcs: {
    key: 'pcs',
    label: 'PCS',
    // Canonical PCS home — the legacy /pcs tree now 308-redirects here.
    href: '/research/pcs',
    activeClasses: 'bg-pacific-600 text-white shadow-sm',
    inactiveClasses: 'text-pacific-700 hover:bg-pacific-50',
  },
  'sqr-rct': {
    key: 'sqr-rct',
    label: 'SQR-RCT',
    href: '/dashboard',
    activeClasses: 'bg-pacific-600 text-white shadow-sm',
    inactiveClasses: 'text-pacific-700 hover:bg-pacific-50',
  },
};

export default function PlatformToggle({ currentPlatform = 'pcs' }) {
  const { user } = useAuth();
  const hasPcs = hasAnyRole(user, ROLE_SETS.PCS_ANY);
  const hasSqr = hasAnyRole(user, ROLE_SETS.SQR_REVIEWERS);

  // If the user has only one platform, render nothing — the pill would
  // either be a tautology (active = current) or hidden (no access to
  // the other side). The mobile dropdown still surfaces the link.
  if (!(hasPcs && hasSqr)) return null;

  const order = ['pcs', 'sqr-rct'];
  return (
    <div
      className="hidden sm:inline-flex items-center rounded-full border border-pacific-200 bg-white p-0.5"
      role="tablist"
      aria-label="Platform"
    >
      {order.map((key) => {
        const p = PLATFORMS[key];
        const active = key === currentPlatform;
        return (
          <Link
            key={key}
            href={p.href}
            role="tab"
            aria-selected={active}
            aria-current={active ? 'page' : undefined}
            className={[
              'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
              active ? p.activeClasses : p.inactiveClasses,
            ].join(' ')}
            tabIndex={active ? -1 : 0}
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}
