'use client';

/**
 * LegacyBanner — shown when `doc.templateVersion === 'Legacy pre-Lauren'`.
 *
 * Wave 4.3.0 renders the informational banner only. The "Request re-issue"
 * action will be wired up in Phase 4.3.2 (BackfillSideSheet).
 */
export default function LegacyBanner({ doc }) {
  if (!doc || doc.templateVersion !== 'Legacy pre-Lauren') return null;

  // Parse templateSignals (stored as JSON text on the document) defensively.
  let positive = null;
  let negative = null;
  if (doc.templateSignals) {
    try {
      const parsed = JSON.parse(doc.templateSignals);
      positive = parsed?.positiveCount ?? null;
      negative = parsed?.negativeCount ?? null;
    } catch {
      // Not JSON — ignore.
    }
  }

  return (
    <div
      role="note"
      className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2"
    >
      <div className="flex items-center gap-2">
        <span className="text-amber-700 text-sm font-semibold">
          Legacy document — pre-Lauren template
        </span>
      </div>
      <p className="text-sm text-amber-900">
        This PCS was authored before Lauren Bozzio&apos;s 10-table template was
        standardized. Some sections may be empty or partially populated. Tables
        1, 2, 3A, and 4 may require backfill before claim substantiation can be
        verified.
      </p>
      {(positive !== null || negative !== null) && (
        <div className="flex items-center gap-2 pt-1">
          {positive !== null && (
            <span className="px-2 py-0.5 text-xs rounded bg-white border border-amber-200 text-amber-800">
              positive: {positive}
            </span>
          )}
          {negative !== null && (
            <span className="px-2 py-0.5 text-xs rounded bg-white border border-amber-200 text-amber-800">
              negative: {negative}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
