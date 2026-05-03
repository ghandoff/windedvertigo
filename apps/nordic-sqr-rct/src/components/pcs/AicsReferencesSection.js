'use client';

/**
 * Bundle 3.4 P1 — AICS References section on the PCS document detail page.
 *
 * Displays the upstream AICS substantiation files this PCS doc inherits from.
 * Reads from `linkedAicsIds` on the parsed PCS document (a Notion DUAL relation
 * to AICS Documents added 2026-05-03). Each linked id is hydrated to its
 * AICS metadata via `/api/pcs/aics/[id]`.
 *
 * P1 scope (today): READ-ONLY display + a callout explaining how RA can link
 * AICS docs directly in Notion. Phase 3.4 P2 adds the in-platform picker.
 *
 * Empty-state UX: friendly, RA-targeted copy explaining what AICS is and
 * how to attach the first one. Pre-Notion-env-var: same as everywhere else
 * — graceful "configuration pending" amber card.
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

export default function AicsReferencesSection({ linkedAicsIds }) {
  const ids = useMemo(() => Array.isArray(linkedAicsIds) ? linkedAicsIds : [], [linkedAicsIds]);
  const [aicsDocs, setAicsDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [configError, setConfigError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (ids.length === 0) {
      queueMicrotask(() => { if (!cancelled) setAicsDocs([]); });
      return () => { cancelled = true; };
    }
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setConfigError(null);
    });
    Promise.all(ids.map((id) => (
      fetch(`/api/pcs/aics/${id}`)
        .then(async (r) => {
          if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${r.status}`);
          }
          return r.json();
        })
        .catch((err) => ({ id, _error: err?.message || 'unknown' }))
    )))
      .then((results) => {
        if (cancelled) return;
        const errored = results.find((r) => r._error && /NOTION_AICS|database_id|configured/i.test(r._error));
        if (errored) {
          setConfigError('AICS Notion databases are pending Vercel env-var configuration. Linked AICS show as IDs only until env vars land.');
        }
        setAicsDocs(results);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ids]);

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">AICS References</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Upstream Active Ingredient Claims Substantiation files this PCS doc inherits from.
          </p>
        </div>
        <span className="text-xs text-gray-400">
          {ids.length} linked
        </span>
      </div>

      {configError ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {configError}
        </div>
      ) : null}

      {ids.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white px-4 py-5 text-sm text-gray-600">
          <p>
            No AICS docs linked yet. <span className="font-medium">RA</span> can link upstream
            AICS substantiation in two ways:
          </p>
          <ul className="mt-2 list-disc list-inside space-y-1 text-xs text-gray-500">
            <li>
              In Notion directly: open this PCS doc&apos;s Notion page and use the <span className="font-mono bg-white px-1 rounded">Linked AICS</span> relation field.
            </li>
            <li>
              In the platform: the in-app picker is on the roadmap (Phase 3.4 P2). Until then, Notion is canonical.
            </li>
          </ul>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ids.map((id) => (
            <div key={id} className="h-14 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {aicsDocs.map((aics) => {
            if (aics._error) {
              return (
                <li key={aics.id} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs">
                  <div className="font-mono text-gray-700 truncate" title={aics.id}>{aics.id}</div>
                  <div className="text-amber-700 mt-0.5">Failed to load: {aics._error}</div>
                </li>
              );
            }
            return (
              <li key={aics.id} className="rounded-md border border-gray-200 bg-white px-3 py-2">
                <Link href={`/pcs/aics/${aics.id}`} className="block hover:underline">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-pacific-700 text-sm">{aics.aicsId || 'AICS'}</span>
                    {aics.raReviewStatus ? (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        aics.raReviewStatus === 'Approved' ? 'bg-green-100 text-green-700'
                          : aics.raReviewStatus === 'Pending RA Review' ? 'bg-yellow-100 text-yellow-700'
                          : aics.raReviewStatus === 'Rejected' ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {aics.raReviewStatus}
                      </span>
                    ) : null}
                  </div>
                  {aics.aiNameText ? (
                    <div className="text-xs text-gray-600 mt-0.5">{aics.aiNameText}</div>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
