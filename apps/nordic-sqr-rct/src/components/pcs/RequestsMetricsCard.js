'use client';

/**
 * Wave 4.5.4 — Research Requests health metrics card.
 *
 * Three tiles:
 *   1) Median time-to-resolve (all) — tooltip shows by-type + by-role breakdown.
 *   2) Coverage debt — "X% of active PCS have open requests".
 *   3) Queue staleness — "p50: Xd / p95: Yd" with red indicator if p95 > 30.
 *
 * Fetches /api/pcs/requests/metrics on mount and shows a skeleton while loading.
 */

import { useEffect, useState } from 'react';

function Skeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

function Tile({ label, children, tooltip, accent }) {
  return (
    <div
      className={`relative rounded-lg border p-4 bg-white ${accent === 'red' ? 'border-red-300' : 'border-gray-200'}`}
      title={tooltip || undefined}
    >
      <div className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}

function formatDays(val) {
  if (val == null) return '—';
  return `${val}d`;
}

export default function RequestsMetricsCard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/pcs/requests/metrics')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => { if (!cancelled) setMetrics(data); })
      .catch(err => { if (!cancelled) setError(err.message || String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Skeleton />;
  if (error) {
    return (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
        Metrics unavailable: {error}
      </div>
    );
  }
  if (!metrics) return null;

  const { medianTimeToResolve, coverageDebt, staleness } = metrics;

  const medianTooltip = [
    'By type:',
    ...Object.entries(medianTimeToResolve?.byType || {}).map(
      ([k, v]) => `  ${k}: ${v == null ? 'n/a' : v + 'd'}`,
    ),
    'By role:',
    ...Object.entries(medianTimeToResolve?.byRole || {}).map(
      ([k, v]) => `  ${k}: ${v == null ? 'n/a' : v + 'd'}`,
    ),
    `Based on ${medianTimeToResolve?.basedOn ?? 0} resolved requests in last ${medianTimeToResolve?.windowDays ?? 90}d.`,
  ].join('\n');

  const p95Alert = staleness?.alert === true;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
      <Tile label="Median time-to-resolve" tooltip={medianTooltip}>
        <div className="text-3xl font-bold text-gray-900">
          {formatDays(medianTimeToResolve?.all)}
        </div>
        <div className="mt-1 text-xs text-gray-500">
          {(medianTimeToResolve?.basedOn ?? 0)} resolved · last {medianTimeToResolve?.windowDays ?? 90}d
        </div>
      </Tile>

      <Tile label="Coverage debt">
        <div className="text-3xl font-bold text-gray-900">
          {coverageDebt?.pctDocumentsWithOpenRequests ?? 0}%
        </div>
        <div className="mt-1 text-xs text-gray-500">
          {coverageDebt?.pcsWithOpenRequests ?? 0} of {coverageDebt?.totalActivePcs ?? 0} active PCS
        </div>
      </Tile>

      <Tile label="Queue staleness" accent={p95Alert ? 'red' : undefined}>
        <div className="flex items-baseline gap-3">
          <div className="text-sm text-gray-600">
            p50 <span className="font-bold text-gray-900 text-xl">{formatDays(staleness?.p50OpenAgeDays)}</span>
          </div>
          <div className="text-sm text-gray-600">
            p95 <span className={`font-bold text-xl ${p95Alert ? 'text-red-600' : 'text-gray-900'}`}>
              {formatDays(staleness?.p95OpenAgeDays)}
            </span>
            {p95Alert && (
              <span
                className="ml-1 inline-block w-2 h-2 rounded-full bg-red-500 align-middle"
                aria-label="p95 exceeds 30 days"
                title="p95 exceeds 30 days — queue is becoming stale"
              />
            )}
          </div>
        </div>
        <div className="mt-1 text-xs text-gray-500">
          {staleness?.openCount ?? 0} open
          {staleness?.oldestOpenRequest?.ageDays != null && (
            <> · oldest {staleness.oldestOpenRequest.ageDays}d</>
          )}
        </div>
      </Tile>
    </div>
  );
}
