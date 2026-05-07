'use client';

import { useState, useEffect } from 'react';

/**
 * /admin/postgres-mirror — Path-2 Phase A observability dashboard.
 *
 * Shows per-table parity between Notion (canonical) and Postgres
 * (mirror) for every PCS table that's been swapped. Color-coded
 * status helps spot drift immediately:
 *   green  — ok (counts match, data fresh, OR no data)
 *   amber  — stale (counts match but Postgres last edit > 30 min ago)
 *   red    — drifted (count mismatch > 5)
 *   gray   — no_pg (Postgres table missing or query errored)
 *
 * Auto-refreshes every 60s. Manual refresh button below the summary.
 *
 * Requires `pcs.admin:read` capability — same gate as the other admin
 * routes in this app.
 */
export default function PostgresMirrorPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  // 2026-05-06 — lazy initializer; React 19's strict mode flags
  // calling impure functions (Date.now()) inline as the initial value.
  const [refreshTs, setRefreshTs] = useState(() => Date.now());

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/api/admin/postgres-mirror-status')
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTs]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Auto-refresh every 60s — matches the cache TTL on the underlying
  // GETs so we don't fight the edge cache.
  useEffect(() => {
    const id = setInterval(() => setRefreshTs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (loading && !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-72 rounded bg-gray-200" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-32 rounded bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4">
        <h2 className="text-base font-semibold text-red-800">Mirror status check failed</h2>
        <p className="mt-1 text-sm text-red-700">{error}</p>
        <button
          onClick={() => setRefreshTs(Date.now())}
          className="mt-3 rounded-md bg-white border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Postgres mirror status</h1>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Path-2 Phase A: Notion is canonical, Postgres is the read mirror.
            Drift between the two should be ≤ 5 rows and ≤ 30 minutes —
            anything more means the drift cron isn’t catching up.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-gray-500">
            Read flag:{' '}
            <span className={data.flagOn ? 'font-semibold text-emerald-700' : 'text-gray-700'}>
              {data.flagOn ? 'PG ON' : 'OFF (Notion-only)'}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Checked in {data.durationMs}ms · auto-refresh 60s
          </div>
          <button
            onClick={() => setRefreshTs(Date.now())}
            className="mt-2 rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Refresh now
          </button>
        </div>
      </div>

      <SummaryStrip summary={data.summary} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.results.map((r) => (
          <TableCard key={r.table} row={r} />
        ))}
      </div>
    </div>
  );
}

function SummaryStrip({ summary }) {
  const items = [
    { key: 'ok', label: 'In sync', tone: 'emerald' },
    { key: 'no_data', label: 'Empty', tone: 'gray' },
    { key: 'stale', label: 'Stale', tone: 'amber' },
    { key: 'drifted', label: 'Drifted', tone: 'red' },
    { key: 'no_pg', label: 'Postgres missing', tone: 'gray' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {items.map((it) => {
        const n = summary[it.key] ?? 0;
        const dim = n === 0;
        return (
          <div
            key={it.key}
            className={`rounded-md border px-3 py-2 ${
              dim ? 'border-gray-200 bg-gray-50' : `border-${it.tone}-200 bg-${it.tone}-50`
            }`}
          >
            <div className={`text-xs font-medium ${dim ? 'text-gray-500' : `text-${it.tone}-700`}`}>
              {it.label}
            </div>
            <div className={`text-xl font-semibold mt-0.5 ${dim ? 'text-gray-400' : `text-${it.tone}-800`}`}>
              {n}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TableCard({ row }) {
  const tone = TONE[row.status] || TONE.no_pg;
  return (
    <div className={`rounded-lg border p-3 ${tone.border} ${tone.bg}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="font-mono text-sm font-semibold text-gray-900">{row.table}</div>
        <span className={`text-[10px] uppercase tracking-wide font-semibold ${tone.label}`}>
          {row.status}
        </span>
      </div>

      {row.error ? (
        <p className="mt-2 text-xs text-red-700">{row.error}</p>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <Stat label="Postgres" value={fmtCount(row.pgCount)} />
            <Stat label="Notion" value={fmtCount(row.notionCount)} />
            <Stat
              label="Δ"
              value={row.delta != null ? (row.delta > 0 ? `+${row.delta}` : String(row.delta)) : '—'}
              valueClass={
                row.delta == null
                  ? 'text-gray-500'
                  : Math.abs(row.delta) > 5
                  ? 'text-red-700 font-semibold'
                  : 'text-gray-700'
              }
            />
          </div>
          <div className="mt-2 text-[11px] text-gray-600">
            Last edit:{' '}
            <span className="font-medium">
              {row.latestPgEditedAt
                ? `${fmtAgo(row.secondsSinceLatestEdit)} ago`
                : '—'}
            </span>
            <span className="ml-3 text-gray-400">{row.durationMs}ms</span>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, valueClass = 'text-gray-700' }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-sm font-mono ${valueClass}`}>{value}</div>
    </div>
  );
}

const TONE = {
  ok: { border: 'border-emerald-200', bg: 'bg-emerald-50', label: 'text-emerald-700' },
  no_data: { border: 'border-gray-200', bg: 'bg-gray-50', label: 'text-gray-500' },
  stale: { border: 'border-amber-200', bg: 'bg-amber-50', label: 'text-amber-700' },
  drifted: { border: 'border-red-200', bg: 'bg-red-50', label: 'text-red-700' },
  no_pg: { border: 'border-gray-200', bg: 'bg-gray-50', label: 'text-gray-500' },
};

function fmtCount(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

function fmtAgo(seconds) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
