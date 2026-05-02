'use client';

/**
 * DisabledNavLink — renders a dimmed, non-interactive nav item with a
 * tooltip explaining why it's disabled. Intended for admin-only operations
 * (Import, Label Import, Backfill) that RA / Research-team users should
 * still *see* in the nav so they know the capability exists and whom to ask.
 *
 * Motivated by the orphan-surface audit in
 * `docs/design/nav-redesign.md` §7 ("Admin-only items visibility") — the
 * audit recommends disabled-with-tooltip over hard hiding for RA users so
 * discoverability of admin capabilities is preserved without granting write
 * access.
 *
 * Wave 6.x (`src/components/pcs/PcsSidebar.js`, not yet built) is expected
 * to consume this component when the nav is refactored from the current
 * flat top bar (`PcsNav.js`) to a grouped left sidebar. Until then this
 * lives unused as a forward-compatible building block.
 *
 * Props:
 *   - label:    string — the item label, e.g. "Import"
 *   - tooltip:  string — optional override for the title attribute.
 *                        Defaults to "Admin-only action. Ask a PCS admin
 *                        to run this."
 *   - icon:     optional ReactNode rendered before the label
 *   - className: optional extra classes to merge with the dimmed style
 */
export default function DisabledNavLink({
  label,
  tooltip = 'Admin-only action. Ask a PCS admin to run this.',
  icon = null,
  className = '',
}) {
  return (
    <span
      role="link"
      aria-disabled="true"
      tabIndex={-1}
      title={tooltip}
      className={[
        // Dimmed, non-interactive; matches the rest of the PCS nav's
        // padding/typography so it slots into existing nav lists.
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium',
        'text-gray-400 cursor-not-allowed select-none',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon}
      <span>{label}</span>
      <span className="sr-only"> (disabled — admin only)</span>
    </span>
  );
}
