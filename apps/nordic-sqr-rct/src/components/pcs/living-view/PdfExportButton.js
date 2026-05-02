'use client';

import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/components/Toast';

/**
 * PdfExportButton — Wave 4.3.4.
 *
 * Two options exposed as a small dropdown:
 *   1. "Download as Word (.docx)" — streams the docx from the export endpoint
 *      and triggers a browser download.
 *   2. "Print / Save as PDF" — opens the docx in a new tab with an
 *      instruction toast. The user then uses their browser's print dialog to
 *      save a PDF. This is the Wave 4.3 accepted approach (docx pipeline +
 *      browser print-to-PDF; server-side PDF rejected).
 *
 * Legacy (pre-Lauren) docs show a "(partial — legacy)" suffix on the button
 * label so reviewers know the output is intentionally incomplete.
 */
export default function PdfExportButton({ doc }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null); // 'docx' | 'pdf' | null
  const wrapperRef = useRef(null);

  const isLegacy = doc?.templateVersion === 'Legacy pre-Lauren';
  const docxUrl = doc?.id
    ? `/api/pcs/export/docx?type=lauren-template&documentId=${encodeURIComponent(doc.id)}`
    : null;

  // Close the dropdown on outside click or escape key.
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function filenameFromHeader(res, fallback) {
    const cd = res.headers.get('Content-Disposition') || '';
    const m = /filename="?([^"]+)"?/.exec(cd);
    return m?.[1] || fallback;
  }

  async function handleDownloadDocx() {
    if (!docxUrl) return;
    setBusy('docx');
    try {
      const res = await fetch(docxUrl);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const name = filenameFromHeader(res, `PCS-${doc.pcsId || doc.id}.docx`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Document downloaded');
    } catch (err) {
      console.error('docx download failed', err);
      toast.error('Export failed — please try again');
    } finally {
      setBusy(null);
      setOpen(false);
    }
  }

  function handlePrintPdf() {
    if (!docxUrl) return;
    setBusy('pdf');
    try {
      window.open(docxUrl, '_blank', 'noopener,noreferrer');
      toast.info('Open the downloaded file, then use your browser or Word print dialog to save as PDF.');
    } finally {
      setBusy(null);
      setOpen(false);
    }
  }

  const label = isLegacy ? 'Export (partial — legacy)' : 'Export';
  const disabled = !docxUrl || busy !== null;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-pacific-600 rounded-md hover:bg-pacific-700 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {busy ? (
          <span
            aria-hidden="true"
            className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"
          />
        ) : null}
        <span>{busy ? 'Generating…' : label}</span>
        <svg className="w-3 h-3 opacity-80" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-64 rounded-md border border-gray-200 bg-white shadow-lg z-20 py-1"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleDownloadDocx}
            disabled={busy !== null}
            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            <div className="font-medium text-gray-900">Download as Word (.docx)</div>
            <div className="text-[11px] text-gray-500">Lauren template — 10 tables</div>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handlePrintPdf}
            disabled={busy !== null}
            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            <div className="font-medium text-gray-900">Print / Save as PDF</div>
            <div className="text-[11px] text-gray-500">
              Opens docx in a new tab — use your browser print dialog.
            </div>
          </button>
          {isLegacy && (
            <div className="px-3 pt-1 pb-2 text-[11px] text-amber-700 border-t border-gray-100 mt-1">
              Legacy pre-Lauren document — sections may be partial or empty.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
