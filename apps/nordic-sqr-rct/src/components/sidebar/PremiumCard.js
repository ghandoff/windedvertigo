'use client';

/**
 * Wave 8 Phase B — Premium teaser card for the role-aware sidebar.
 *
 * Renders a Premium feature in one of two states:
 *   - locked  → 🔒 icon, label, description, "Premium retainer tier" badge,
 *                tooltip on hover, no navigation. Used for non-super-user
 *                roles to seed Sharon-side budget conversations.
 *   - unlocked → live <Link> to the placeholder preview route. Used for
 *                super-user only.
 *
 * The card is intentionally heavier than a normal `SidebarItem` — it's
 * meant to stand out visually so it reads as a premium upsell, not a nav
 * link the operator might miss.
 */

import Link from 'next/link';

const TOOLTIP_TEXT =
  "This feature is part of Winded Vertigo's R&D retainer (Priority tier). " +
  'Available now to super-users; contact garrett@windedvertigo.com to enable for your tier.';

export default function PremiumCard({ item, locked }) {
  const baseClasses =
    'group block w-full rounded-md border px-3 py-2 text-left transition-colors';

  if (locked) {
    return (
      <div
        className={[baseClasses, 'cursor-not-allowed border-gold-200 bg-gold-50 hover:bg-gold-100'].join(' ')}
        title={TOOLTIP_TEXT}
        role="note"
        aria-label={`${item.label} — Premium retainer tier`}
      >
        <div className="flex items-start gap-1.5">
          <span aria-hidden="true" className="text-xs leading-5">🔒</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-gray-700">
                {item.label}
              </span>
            </div>
            {item.description ? (
              <p className="mt-0.5 text-[11px] leading-snug text-gray-600">
                {item.description}
              </p>
            ) : null}
            <span className="mt-1 inline-flex items-center rounded-full bg-gold-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gold-900">
              Premium retainer tier
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={[baseClasses, 'border-gold-300 bg-gold-50 hover:bg-gold-100'].join(' ')}
      title={`${item.label} — preview (super-user)`}
    >
      <div className="flex items-start gap-1.5">
        <span aria-hidden="true" className="text-xs leading-5">✨</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-pacific-700 group-hover:text-pacific-800">
              {item.label}
            </span>
          </div>
          {item.description ? (
            <p className="mt-0.5 text-[11px] leading-snug text-gray-600">
              {item.description}
            </p>
          ) : null}
          <span className="mt-1 inline-flex items-center rounded-full bg-pacific-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-pacific-700">
            Preview unlocked
          </span>
        </div>
      </div>
    </Link>
  );
}
