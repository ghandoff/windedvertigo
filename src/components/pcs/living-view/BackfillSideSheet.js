'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/useAuth';
import { REQUEST_STATUSES } from '@/lib/pcs-config';

/**
 * BackfillSideSheet — CREATE variant (Wave 4.3.1).
 *
 * Distinct from Wave 4.5.1's RequestDetailSideSheet (view/resolve variant).
 * Portal-rendered right-side slide-over that pre-fills a Research Request
 * draft from a section's sectionHealth signal, then POSTs to
 * /api/pcs/requests (which is already implemented).
 *
 * Props:
 *   open         — boolean
 *   onClose      — () => void
 *   onCreated    — (createdRequest) => void  (parent can refetch sectionHealth)
 *   draft        — {
 *     sectionKey, sectionLabel, variant, title, notes, relatedClaimIds?
 *   }
 *   doc          — document payload (used to show the PCS id header)
 *   version      — latest version (used for relation + auto-title)
 */
export default function BackfillSideSheet({
  open,
  onClose,
  onCreated,
  draft,
  doc,
  version,
}) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('New');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Portal mount check.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Re-seed form whenever the draft changes (user opens a new badge).
  useEffect(() => {
    if (!open) return;
    setTitle(draft?.title || buildDefaultTitle(draft, doc, version));
    setNotes(draft?.notes || buildDefaultNotes(draft, doc, version));
    setStatus('New');
    setError(null);
  }, [open, draft, doc, version]);

  // Close on Esc.
  useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const requestedBy =
    user?.displayName || user?.alias || user?.email || '';

  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        request: title,
        status,
        requestedBy,
        requestNotes: notes,
      };
      if (version?.id) body.pcsVersionId = version.id;
      if (draft?.relatedClaimIds?.length) {
        body.relatedClaimIds = draft.relatedClaimIds;
      }
      if (draft?.requestType) body.requestType = draft.requestType;
      if (draft?.specificField) body.specificField = draft.specificField;
      const res = await fetch('/api/pcs/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed (${res.status})`);
      }
      const created = await res.json();
      onCreated?.(created);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Failed to create request');
    } finally {
      setSubmitting(false);
    }
  };

  const panel = (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backfill-sheet-title"
    >
      {/* Scrim */}
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />
      {/* Panel */}
      <aside className="fixed inset-y-0 right-0 w-96 max-w-full bg-white shadow-xl border-l border-gray-200 flex flex-col">
        <header className="px-4 py-3 border-b border-gray-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              New Research Request
            </p>
            <h2
              id="backfill-sheet-title"
              className="text-base font-semibold text-gray-900 truncate"
            >
              {draft?.sectionLabel
                ? `Backfill — ${draft.sectionLabel}`
                : 'Backfill request'}
            </h2>
            {doc?.pcsId && (
              <p className="text-xs text-gray-500 mt-0.5">
                {doc.pcsId}
                {version?.version ? ` · v${version.version}` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-gray-500 hover:text-gray-800 text-xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        >
          <div>
            <label
              htmlFor="backfill-title"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Request title
            </label>
            <input
              id="backfill-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-pacific-500"
            />
          </div>

          <div>
            <label
              htmlFor="backfill-notes"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Notes
            </label>
            <textarea
              id="backfill-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={6}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-pacific-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="backfill-status"
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                Status
              </label>
              <select
                id="backfill-status"
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-pacific-500"
              >
                {REQUEST_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="block text-xs font-medium text-gray-700 mb-1">
                Requested by
              </p>
              <p className="px-2 py-1.5 text-sm text-gray-600 border border-dashed border-gray-200 rounded">
                {requestedBy || '—'}
              </p>
            </div>
          </div>

          {draft?.variant && (
            <p className="text-xs text-gray-500">
              Triggered by a <span className="font-medium">{draft.variant}</span>{' '}
              signal on {draft.sectionLabel || draft.sectionKey}.
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              {error}
            </p>
          )}
        </form>

        <footer className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="px-3 py-1.5 text-xs font-medium text-white bg-pacific-600 rounded hover:bg-pacific-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating…' : 'Create Request'}
          </button>
        </footer>
      </aside>
    </div>
  );

  return createPortal(panel, document.body);
}

function buildDefaultTitle(draft, doc, version) {
  const section = draft?.sectionLabel || draft?.sectionKey || 'section';
  const pcsId = doc?.pcsId ? ` for ${doc.pcsId}` : '';
  const v = version?.version ? `v${version.version}` : '';
  return `Backfill: ${section}${pcsId}${v ? ` ${v}` : ''}`.trim();
}

function buildDefaultNotes(draft, doc, version) {
  const lines = [
    `Section: ${draft?.sectionLabel || draft?.sectionKey || '(unspecified)'}`,
    `Signal: ${draft?.variant || 'warning'}`,
    `PCS: ${doc?.pcsId || '(no id)'}${version?.version ? ` · v${version.version}` : ''}`,
    '',
    'What is missing or needs review:',
    '-',
    '',
    'Impact on claim substantiation:',
    '-',
  ];
  return lines.join('\n');
}
