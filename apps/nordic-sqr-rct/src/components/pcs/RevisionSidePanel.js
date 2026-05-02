'use client';

/**
 * Wave 8 Phase D — Revisions side panel.
 *
 * Slide-in panel from the right that lists revisions for a single entity,
 * newest first. Each row expands to show a before/after diff. Super-users
 * see a "Revert this change" button (gated via <Can>) which opens a
 * reason-required confirm, then POSTs to the Phase A revert endpoint.
 *
 * Integration: mount near the page root; control via `open` / `onClose`.
 * Refetches on open and after a successful revert.
 */

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Can from '@/components/auth/Can';
import RevisionDiffView from './RevisionDiffView';

const DATE_FILTERS = [
  { id: 'all', label: 'All time' },
  { id: '7d', label: 'Last 7d' },
  { id: '24h', label: 'Last 24h' },
];

function relativeTime(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function Toast({ kind = 'success', message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss?.(), 4500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  const cls =
    kind === 'success'
      ? 'bg-green-600 text-white'
      : kind === 'error'
      ? 'bg-red-600 text-white'
      : 'bg-gray-800 text-white';
  return (
    <div className={`fixed bottom-6 right-6 z-[10002] px-4 py-2 rounded-md shadow-lg text-sm ${cls}`}>
      {message}
    </div>
  );
}

export default function RevisionSidePanel({
  entityType,
  entityId,
  entityLabel,
  open,
  onClose,
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  // Filters
  const [actorFilter, setActorFilter] = useState('');
  const [fieldFilter, setFieldFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  // Revert dialog
  const [revertTarget, setRevertTarget] = useState(null); // revision object
  const [revertReason, setRevertReason] = useState('');
  const [reverting, setReverting] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  useEffect(() => { setMounted(true); }, []);

  const fetchRevisions = useCallback(async () => {
    if (!entityId || !entityType) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        entityId: String(entityId),
        entityType: String(entityType),
        limit: '20',
      });
      const res = await fetch(`/api/admin/pcs/revisions?${params.toString()}`);
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setRevisions(Array.isArray(data?.revisions) ? data.revisions : []);
    } catch (e) {
      setError(e?.message || String(e));
      setRevisions([]);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    if (open) fetchRevisions();
  }, [open, fetchRevisions]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !revertTarget) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, revertTarget]);

  const filtered = revisions.filter((r) => {
    if (actorFilter && !(r.actorEmail || '').toLowerCase().includes(actorFilter.toLowerCase())) return false;
    if (fieldFilter && !(r.fieldPath || '').toLowerCase().includes(fieldFilter.toLowerCase())) return false;
    if (dateFilter !== 'all') {
      const ts = r.timestamp ? new Date(r.timestamp).getTime() : 0;
      if (!ts) return false;
      const age = Date.now() - ts;
      if (dateFilter === '7d' && age > 7 * 24 * 3600 * 1000) return false;
      if (dateFilter === '24h' && age > 24 * 3600 * 1000) return false;
    }
    return true;
  });

  async function handleRevertConfirm() {
    if (!revertTarget) return;
    if (!revertReason.trim()) {
      setToast({ kind: 'error', message: 'A reason is required to revert.' });
      return;
    }
    setReverting(true);
    try {
      const res = await fetch(`/api/admin/pcs/revisions/${revertTarget.id}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: revertReason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
      }
      setToast({
        kind: 'success',
        message: data?.dryRun
          ? (data?.message || 'Revert audit logged. Live entity not rewritten (no updater wired for this entity type yet).')
          : 'Revision reverted. Live entity rewritten to the pre-edit value.',
      });
      setRevertTarget(null);
      setRevertReason('');
      await fetchRevisions();
    } catch (e) {
      setToast({ kind: 'error', message: e?.message || 'Revert failed.' });
    } finally {
      setReverting(false);
    }
  }

  if (!mounted || !open) return null;

  const panel = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-[10000]"
        onClick={() => !revertTarget && onClose?.()}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Revision history"
        className="fixed top-0 right-0 bottom-0 w-full max-w-xl bg-white shadow-2xl z-[10001] flex flex-col"
      >
        <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">Revision history</h2>
            {entityLabel && (
              <p className="text-xs text-gray-500 truncate">{entityLabel}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {/* Filters */}
        <div className="px-4 py-2 border-b border-gray-200 space-y-2 bg-gray-50">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              placeholder="Filter by actor email"
              className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
            />
            <input
              type="text"
              value={fieldFilter}
              onChange={(e) => setFieldFilter(e.target.value)}
              placeholder="Filter by field path"
              className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
            />
          </div>
          <div className="inline-flex rounded-md border border-gray-300 overflow-hidden text-xs font-medium">
            {DATE_FILTERS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDateFilter(d.id)}
                className={`px-2.5 py-1 transition-colors ${
                  dateFilter === d.id
                    ? 'bg-pacific-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                } ${d.id !== 'all' ? 'border-l border-gray-300' : ''}`}
                aria-pressed={dateFilter === d.id}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-4 text-sm text-gray-500">Loading revisions…</div>
          )}
          {error && !loading && (
            <div className="p-4 text-sm text-red-600">
              Failed to load revisions: {error}
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="p-4 text-sm text-gray-500">
              {revisions.length === 0
                ? 'No revisions yet for this entity.'
                : 'No revisions match the current filters.'}
            </div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {filtered.map((r) => {
                const expanded = expandedId === r.id;
                const isReverted = Boolean(r.revertedAt);
                return (
                  <li key={r.id} className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : r.id)}
                      className="w-full flex items-start justify-between gap-2 text-left"
                      aria-expanded={expanded}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-gray-900 truncate">
                            {r.fieldPath || 'bulk'}
                          </span>
                          {isReverted && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-200 text-gray-700">
                              reverted
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                          {relativeTime(r.timestamp)} · {r.actorEmail || 'unknown'}
                        </div>
                      </div>
                      <span className="text-gray-400 text-xs shrink-0">
                        {expanded ? '▾' : '▸'}
                      </span>
                    </button>

                    {expanded && (
                      <div className="mt-2 space-y-2">
                        <RevisionDiffView
                          beforeValue={r.beforeValue}
                          afterValue={r.afterValue}
                        />
                        {r.reason && (
                          <div className="text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-2 py-1">
                            <span className="font-semibold">Reason:</span> {r.reason}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] text-gray-400 font-mono">
                            id: {r.id.slice(0, 8)}…
                          </div>
                          {!isReverted && (
                            <Can capability="pcs.revisions:revert">
                              <button
                                type="button"
                                onClick={() => {
                                  setRevertTarget(r);
                                  setRevertReason('');
                                }}
                                className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
                              >
                                Revert this change
                              </button>
                            </Can>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="px-4 py-2 border-t border-gray-200 text-[11px] text-gray-500 flex items-center justify-between">
          <span>{filtered.length} of {revisions.length} shown</span>
          <button
            type="button"
            onClick={fetchRevisions}
            className="text-pacific-600 hover:underline"
          >
            Refresh
          </button>
        </footer>
      </aside>

      {/* Revert confirm dialog */}
      {revertTarget && (
        <div className="fixed inset-0 z-[10003] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !reverting && setRevertTarget(null)}
          />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-3">
            <h3 className="text-base font-semibold text-gray-900">Revert this change?</h3>
            <p className="text-xs text-gray-600">
              For PCS Documents, Claims, Evidence Packets, and Canonical Claims,
              this rewrites the live entity to its pre-edit value and marks the
              original revision as reverted. Other entity types log the audit
              trail only until their live-rewrite path is wired.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Reason <span className="text-red-600">*</span>
              </label>
              <textarea
                value={revertReason}
                onChange={(e) => setRevertReason(e.target.value)}
                rows={3}
                className="w-full text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
                placeholder="Why is this revert needed?"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRevertTarget(null)}
                disabled={reverting}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevertConfirm}
                disabled={reverting || !revertReason.trim()}
                className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {reverting ? 'Reverting…' : 'Confirm revert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          kind={toast.kind}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
}
