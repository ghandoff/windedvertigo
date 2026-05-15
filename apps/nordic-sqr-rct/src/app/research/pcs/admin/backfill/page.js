'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/useAuth';

/**
 * PCS Admin → Backfill Dashboard.
 *
 * Each card runs a server-side backfill pipeline against the corresponding
 * Notion database. All endpoints support `?dry_run=true` for previewing.
 *
 * Multi-profile architecture (Week 2) — added 2026-04-19.
 *
 * ── Navigation note ──────────────────────────────────────────────────────
 * This page is DELIBERATELY NOT linked from the PCS primary nav
 * (`src/components/pcs/PcsNav.js`). It is admin-only maintenance and is
 * reachable via the cross-app `/admin` chip. See §6.2 and §7 of
 * `docs/design/nav-redesign.md` — orphan-surface audit — for the rationale:
 * backfill pipelines are destructive one-shot operations that should never
 * sit next to day-to-day authoring surfaces. If a future Wave 6.x sidebar
 * rebuild introduces a "System / Tools" section (see nav-redesign.md §3),
 * this page can live there; until then, keep it unlinked.
 * ─────────────────────────────────────────────────────────────────────────
 */
export default function PcsBackfillAdminPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">PCS Backfill Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          One-shot maintenance pipelines that populate derived/auxiliary fields
          on existing PCS records. Each runs as the current admin user.
        </p>
      </header>

      <BackfillCard
        title="Claim Prefixes & Core Benefits"
        description="LLM-assisted extraction of Claim prefix + Core benefit (+ Benefit category) for every PCS Claim missing those relations. Lazily creates Core Benefit rows the first time it sees them. ~1 LLM call per claim."
        endpoint="/api/admin/backfill/claim-prefixes"
        supportsLimit
      />

      <BackfillCard
        title="Evidence → Ingredients (keyword)"
        description="Scans untagged Evidence Library entries and tags them by keyword match against Name / Citation / Canonical research summary."
        endpoint="/api/admin/backfill/ingredients"
      />

      <BackfillCard
        title="Ingredient Forms / Relations"
        description="Backfill ingredient-form relations on existing rows. (Owned by a separate pipeline — see scripts/backfill-ingredient-relations.mjs.)"
        endpoint="/api/admin/backfill/ingredient-relations"
      />
    </div>
  );
}

function BackfillCard({ title, description, endpoint, supportsLimit = false }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState('');

  async function run({ dryRun }) {
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const params = new URLSearchParams();
      if (dryRun) params.set('dry_run', 'true');
      if (supportsLimit && limit && /^\d+$/.test(limit)) params.set('limit', limit);
      const qs = params.toString();
      const res = await fetch(`${endpoint}${qs ? `?${qs}` : ''}`, {
        method: 'POST',
        headers: user?.email ? { 'x-user-email': user.email } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
      }
      setResults(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {supportsLimit && (
            <input
              type="number"
              min="1"
              placeholder="limit"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
              disabled={busy}
            />
          )}
          <button
            type="button"
            onClick={() => run({ dryRun: true })}
            disabled={busy}
            className="rounded border border-pacific-600 px-3 py-1.5 text-sm font-medium text-pacific-600 hover:bg-pacific-50 disabled:opacity-50"
          >
            {busy ? 'Running…' : 'Dry-run'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Run "${title}" LIVE against Notion? This will write changes.`)) {
                run({ dryRun: false });
              }
            }}
            disabled={busy}
            className="rounded bg-pacific-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-pacific-700 disabled:opacity-50"
          >
            Run live
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {results && (
        <div className="mt-4 space-y-2">
          {results.summary && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(results.summary).map(([k, v]) => (
                <div key={k} className="rounded bg-gray-50 px-3 py-2 text-xs">
                  <div className="text-gray-500">{k}</div>
                  <div className="mt-0.5 font-mono text-sm font-medium text-gray-900">{String(v)}</div>
                </div>
              ))}
            </div>
          )}
          <details className="rounded border border-gray-200 bg-gray-50 p-2">
            <summary className="cursor-pointer text-xs font-medium text-gray-600">Full response JSON</summary>
            <pre className="mt-2 max-h-96 overflow-auto text-xs text-gray-800">
              {JSON.stringify(results, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}
