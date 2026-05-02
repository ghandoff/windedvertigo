'use client';

/**
 * BackfillBadge — inline "Needs backfill" chip rendered on section headers
 * when `sectionHealth[sectionKey]` is non-null.
 *
 * Three variants per Wave 4.3 plan §4:
 *   - info     (blue)  — non-urgent missing field
 *   - warning  (amber) — template-required field missing
 *   - critical (red)   — blocks claim substantiation
 *
 * Clicking the badge opens BackfillSideSheet (via the `onClick` callback
 * supplied by the parent section).
 */

const VARIANT_STYLES = {
  info: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
  critical: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
};

const VARIANT_LABEL = {
  info: 'Needs backfill',
  warning: 'Needs backfill',
  critical: 'Blocks substantiation',
};

export default function BackfillBadge({ variant, onClick, label, title }) {
  if (!variant) return null;
  const cls = VARIANT_STYLES[variant] || VARIANT_STYLES.info;
  const text = label || VARIANT_LABEL[variant] || 'Needs backfill';

  const content = (
    <>
      <span
        aria-hidden="true"
        className={
          'inline-block w-1.5 h-1.5 rounded-full ' +
          (variant === 'critical'
            ? 'bg-red-500'
            : variant === 'warning'
              ? 'bg-amber-500'
              : 'bg-blue-500')
        }
      />
      {text}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title || text}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border transition-colors ${cls}`}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      title={title || text}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border ${cls}`}
    >
      {content}
    </span>
  );
}
