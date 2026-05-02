'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * VersionPickerDropdown — sticky-header chip that lets the user switch
 * between historical PCS versions of the same document.
 *
 * Data: fetched on open from `/api/pcs/versions?documentId=<id>`.
 * Selection: sets `?versionId=<id>` in the URL. The Living PCS page reads
 * that param and forwards it to `/api/pcs/documents/[id]/view` which
 * returns the requested version's row.
 *
 * "Current" indicator = the version the document's `latestVersion` pointer
 * references (prop `latestVersionId`), falling back to `isLatest=true`.
 */
export default function VersionPickerDropdown({
  documentId,
  currentVersion,
  latestVersionId,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedVersionId = searchParams?.get('versionId') || null;

  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const rootRef = useRef(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Lazy-load versions on first open.
  useEffect(() => {
    if (!open || versions !== null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/pcs/versions?documentId=${encodeURIComponent(documentId)}`)
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(rows => {
        if (cancelled) return;
        // Sort newest-first by effectiveDate (nulls last), then createdTime.
        const sorted = [...(rows || [])].sort((a, b) => {
          const ad = a.effectiveDate || '';
          const bd = b.effectiveDate || '';
          if (ad && bd && ad !== bd) return bd.localeCompare(ad);
          if (ad && !bd) return -1;
          if (!ad && bd) return 1;
          return (b.createdTime || '').localeCompare(a.createdTime || '');
        });
        setVersions(sorted);
      })
      .catch(err => {
        if (!cancelled) setError(err.message || 'Failed to load versions');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, documentId, versions]);

  function selectVersion(versionId, isCurrent) {
    setOpen(false);
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (!versionId || isCurrent) {
      params.delete('versionId');
    } else {
      params.set('versionId', versionId);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }

  const currentLabel = currentVersion || 'version';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors whitespace-nowrap"
        title="Switch version"
      >
        <span>{currentLabel}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-20 mt-1 w-72 max-h-96 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg"
        >
          {loading && (
            <div className="px-3 py-2 text-xs text-gray-500">Loading versions…</div>
          )}
          {error && (
            <div className="px-3 py-2 text-xs text-red-600">{error}</div>
          )}
          {!loading && !error && versions && versions.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">No versions</div>
          )}
          {!loading && !error && versions && versions.map(v => {
            const isCurrent = latestVersionId
              ? v.id === latestVersionId
              : !!v.isLatest;
            const isSelected = selectedVersionId
              ? v.id === selectedVersionId
              : isCurrent;
            const notes = (v.versionNotes || '').trim();
            const truncNotes = notes.length > 80 ? `${notes.slice(0, 80)}…` : notes;
            return (
              <button
                key={v.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => selectVersion(v.id, isCurrent)}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${isSelected ? 'bg-pacific-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-900">{v.version || '—'}</span>
                  <span className="text-gray-500 tabular-nums">
                    {v.effectiveDate || ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {isCurrent && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-pacific-700 bg-pacific-100 rounded">
                      current
                    </span>
                  )}
                  {truncNotes && (
                    <span className="text-gray-600 truncate">{truncNotes}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
