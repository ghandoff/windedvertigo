'use client';

/**
 * Bundle 3.4 — AICS References section on the PCS document detail page.
 *
 * Displays the upstream AICS substantiation files this PCS doc inherits from.
 * Reads from `linkedAicsIds` on the parsed PCS document (a Notion DUAL relation
 * to AICS Documents added 2026-05-03). Each linked id is hydrated to its
 * AICS metadata via `/api/pcs/aics/[id]`.
 *
 * P1 (shipped earlier today): read-only display with empty-state callout.
 * P2 (this commit): in-platform picker — RA / admin / super-user can link
 * an Approved AICS doc via a modal, or unlink with the × button on each card.
 * Optimistic UI; rolls back on 4xx/5xx with an inline error banner.
 *
 * Empty-state UX: friendly, RA-targeted copy explaining what AICS is and
 * how to attach the first one. Pre-Notion-env-var: same as everywhere else
 * — graceful "configuration pending" amber card.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';

export default function AicsReferencesSection({ linkedAicsIds, documentId, canEdit = false }) {
  const [localIds, setLocalIds] = useState(linkedAicsIds);
  const ids = useMemo(() => Array.isArray(localIds) ? localIds : (Array.isArray(linkedAicsIds) ? linkedAicsIds : []), [localIds, linkedAicsIds]);
  const [aicsDocs, setAicsDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mutationError, setMutationError] = useState(null);
  const [mutating, setMutating] = useState(false);

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

  const handleLink = useCallback(async (aicsId) => {
    if (!documentId || !aicsId) return;
    queueMicrotask(() => setMutating(true));
    queueMicrotask(() => setMutationError(null));
    // Optimistic.
    const prevIds = ids;
    setLocalIds([...ids, aicsId]);
    setPickerOpen(false);
    try {
      const r = await fetch(`/api/pcs/documents/${documentId}/linked-aics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aicsDocumentId: aicsId }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${r.status}`);
      }
      const updated = await r.json();
      setLocalIds(updated.linkedAicsIds || []);
    } catch (err) {
      setLocalIds(prevIds);
      setMutationError(`Failed to link AICS: ${err?.message || 'unknown'}`);
    } finally {
      setMutating(false);
    }
  }, [documentId, ids]);

  const handleUnlink = useCallback(async (aicsId) => {
    if (!documentId || !aicsId) return;
    queueMicrotask(() => setMutating(true));
    queueMicrotask(() => setMutationError(null));
    const prevIds = ids;
    setLocalIds(ids.filter((rid) => rid !== aicsId));
    try {
      const r = await fetch(`/api/pcs/documents/${documentId}/linked-aics?aicsDocumentId=${encodeURIComponent(aicsId)}`, { method: 'DELETE' });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${r.status}`);
      }
      const updated = await r.json();
      setLocalIds(updated.linkedAicsIds || []);
    } catch (err) {
      setLocalIds(prevIds);
      setMutationError(`Failed to unlink AICS: ${err?.message || 'unknown'}`);
    } finally {
      setMutating(false);
    }
  }, [documentId, ids]);

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">AICS References</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Upstream Active Ingredient Claims Substantiation files this PCS doc inherits from.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{ids.length} linked</span>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={mutating}
              className="text-xs px-2 py-1 rounded-md bg-pacific-600 text-white hover:bg-pacific-700 disabled:opacity-50 transition"
            >
              + Link AICS doc
            </button>
          ) : null}
        </div>
      </div>

      {mutationError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {mutationError}
        </div>
      ) : null}

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
              <li key={aics.id} className="rounded-md border border-gray-200 bg-white px-3 py-2 group relative">
                <Link href={`/research/pcs/aics/${aics.id}`} className="block hover:underline">
                  <div className="flex items-center justify-between gap-2 pr-6">
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
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => handleUnlink(aics.id)}
                    disabled={mutating}
                    aria-label="Unlink AICS"
                    className="absolute top-1 right-1 w-5 h-5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    ×
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {pickerOpen ? (
        <AicsPickerModal
          alreadyLinkedIds={ids}
          onPick={handleLink}
          onClose={() => setPickerOpen(false)}
          mutating={mutating}
        />
      ) : null}
    </div>
  );
}

// ─── Picker Modal ──────────────────────────────────────────────────────

function AicsPickerModal({ alreadyLinkedIds, onPick, onClose, mutating }) {
  const [allDocs, setAllDocs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setLoading(true); });
    fetch('/api/pcs/aics?status=Approved')
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((approved) => {
        if (cancelled) return;
        // Fall back to ALL aics docs if nothing approved yet (so RA can link in-progress AICS too).
        if (!Array.isArray(approved) || approved.length === 0) {
          return fetch('/api/pcs/aics').then(async (r) => {
            if (!r.ok) return [];
            return r.json();
          }).then((all) => { if (!cancelled) setAllDocs(Array.isArray(all) ? all : []); });
        }
        setAllDocs(approved);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load AICS docs');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const linkedSet = useMemo(() => new Set(alreadyLinkedIds || []), [alreadyLinkedIds]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return allDocs;
    return allDocs.filter((d) =>
      (d.aicsId || '').toLowerCase().includes(q) ||
      (d.aiNameText || '').toLowerCase().includes(q),
    );
  }, [allDocs, search]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Link AICS document"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900">Link an AICS doc</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by AICS ID or active ingredient..."
            className="mt-3 w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pacific-500"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-5 text-sm text-gray-400 text-center">Loading AICS library...</div>
          ) : error ? (
            <div className="p-5 text-sm text-red-700 bg-red-50 border-b border-red-100">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-5 text-sm text-gray-500 text-center">
              {search ? 'No AICS docs match.' : 'No AICS docs in library yet — create one in Notion or via /pcs/aics first.'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((d) => {
                const isLinked = linkedSet.has(d.id);
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => !isLinked && onPick(d.id)}
                      disabled={isLinked || mutating}
                      className={`w-full text-left px-5 py-3 transition ${
                        isLinked ? 'bg-gray-50 cursor-not-allowed opacity-60' : 'hover:bg-pacific-50 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-pacific-700 text-sm">{d.aicsId || 'AICS'}</span>
                        {isLinked ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-gray-200 text-gray-600">already linked</span>
                        ) : d.raReviewStatus ? (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            d.raReviewStatus === 'Approved' ? 'bg-green-100 text-green-700'
                              : d.raReviewStatus === 'Pending RA Review' ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>{d.raReviewStatus}</span>
                        ) : null}
                      </div>
                      {d.aiNameText ? <div className="text-xs text-gray-600 mt-0.5">{d.aiNameText}</div> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
          Click a row to link. AICS docs already linked to this PCS are disabled.
        </div>
      </div>
    </div>
  );
}
