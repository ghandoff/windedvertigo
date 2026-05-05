'use client';

/**
 * Wave 7.4 preview — single sidebar nav link.
 *
 * Active state uses `usePathname()` from `next/navigation`. For the root
 * `/pcs` pin we match exactly so child routes don't highlight the pin;
 * all other items highlight on prefix match.
 *
 * Badge rendering (Wave 7.4 polish):
 *   - If `item.badgeKey` is set, look it up as a dotted path on the
 *     `counts` payload from `useSidebarCounts`.
 *   - While `countsLoading` is true and we haven't resolved a value yet,
 *     show `…` instead of a number.
 *   - Suppress the badge entirely when the resolved value is 0, null, or
 *     undefined — never render a "0" badge.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function readBadgeKey(counts, badgeKey) {
  if (!counts || !badgeKey) return undefined;
  const parts = badgeKey.split('.');
  let cur = counts;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export default function SidebarItem({ item, exact = false, counts = null, countsLoading = false }) {
  const pathname = usePathname();
  const isActive = pathname
    ? exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + '/')
    : false;

  // Resolve badge value: prefer live `badgeKey` lookup; fall back to a
  // literal `item.badge` so the data shape is forward-compatible if any
  // caller ever wants to hardcode a number again.
  let badgeValue;
  let showLoading = false;
  if (item.badgeKey) {
    badgeValue = readBadgeKey(counts, item.badgeKey);
    if (badgeValue == null && countsLoading) showLoading = true;
  } else if (typeof item.badge === 'number') {
    badgeValue = item.badge;
  }

  const showBadge = showLoading || (typeof badgeValue === 'number' && badgeValue > 0);
  const badgeText = showLoading ? '…' : String(badgeValue);

  // 2026-05-05 — When the user clicks a sidebar Link to the page they
  // are already on, Next.js no-ops (correctly — there's nothing to
  // navigate to). But pages with significant client-side state (search
  // panels, filters, etc.) can leave the user "stuck" — they want a
  // way to return to the page's default state without leaving and
  // coming back. We dispatch a window-level event that interested
  // pages listen for and use to reset their local state.
  function handleSamePathReset(e) {
    if (!isActive || typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('nordic:nav-reset', { detail: { href: item.href } }),
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <Link
      href={item.href}
      onClick={handleSamePathReset}
      className={[
        // 2026-05-03 UX pass — items render as lighter-weight, smaller
        // text than the group header above. Active state still uses the
        // pacific accent + becomes semibold so the current page is unmissable.
        'group flex items-center justify-between rounded-md px-2.5 py-1 text-[13px] transition-colors',
        isActive
          ? 'bg-pacific-50 text-pacific-700 font-semibold'
          : 'font-normal text-gray-600 hover:bg-gray-50 hover:text-gray-900',
      ].join(' ')}
    >
      <span className="truncate">{item.label}</span>
      {showBadge ? (
        <span
          className={[
            'ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            isActive
              ? 'bg-pacific-600 text-white'
              : 'bg-gray-200 text-gray-700 group-hover:bg-gray-300',
          ].join(' ')}
        >
          {badgeText}
        </span>
      ) : null}
    </Link>
  );
}
