'use client';

/**
 * 2026-05-04 — shared "coming soon" page shell.
 *
 * Used by the four stubbed-out routes that the sidebar links to but
 * that don't yet have a real implementation:
 *   - /pcs/labels/drift  (Wave 5.2 — drift sweep cron exists; UI deferred)
 *   - /admin/audit       (cross-platform audit log — retainer roadmap)
 *   - /admin/backups     (snapshot recovery UI — retainer roadmap, Phase N5)
 *   - /admin/schema      (Postgres + Notion schema browser — retainer roadmap)
 *
 * Same shell each time, different copy. Renders the route as a real,
 * navigable page so the sidebar link doesn't 404; sets clear expectations
 * for the user about when the feature ships and what the underlying infra
 * already supports.
 */

import Link from 'next/link';

export default function ComingSoonStub({
  title,
  category = 'PCS',
  oneLine,
  status = 'On the retainer roadmap.',
  whatExistsToday = [],
  expectedShip = null,
  backHref = '/pcs',
  backLabel = 'Back to Command Center',
}) {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
      <div className="text-xs text-gray-500 mb-1">{category}</div>
      <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      <p className="mt-3 text-base text-gray-700 leading-relaxed">{oneLine}</p>

      <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 mt-0.5 text-amber-700 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-amber-900">
            <p className="font-semibold">{status}</p>
            {expectedShip ? (
              <p className="mt-1 text-amber-800">
                Expected ship: <span className="font-medium">{expectedShip}</span>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {whatExistsToday.length > 0 ? (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">What exists today</h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-700">
            {whatExistsToday.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-10 pt-6 border-t border-gray-200">
        <Link href={backHref} className="text-sm text-pacific-600 hover:underline font-medium">
          ← {backLabel}
        </Link>
      </div>
    </div>
  );
}
