'use client';

/**
 * Wave 6.0 Data Hub — Label Imports panel.
 *
 * Shallow wrap of /pcs/admin/labels/imports body so it can be rendered as
 * a tab inside /pcs/data. No internal refactor.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/useAuth';

const LABEL_STATUSES = ['Pending', 'Extracting', 'Needs Validation', 'Committed', 'Failed', 'Cancelled'];
const STATUS_STYLES = {
  Pending:            'bg-gray-100 text-gray-700',
  Extracting:         'bg-blue-100 text-blue-700',
  'Needs Validation': 'bg-orange-100 text-orange-800',
  Committed:          'bg-green-100 text-green-700',
  Failed:             'bg-red-100 text-red-700',
  Cancelled:          'bg-zinc-100 text-zinc-500',
};
const REGULATORY_OPTIONS = ['', 'FDA (US)', 'Health Canada', 'EU EFSA', 'ANVISA (Brazil)', 'FSANZ (AU/NZ)', 'Other'];

export default function LabelsImportsPanel() {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;
  if (!user) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Sign in required.
      </div>
    );
  }
  return <LabelImportsDashboard user={user} />;
}

function LabelImportsDashboard({ user }) {
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [listError, setListError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const pollRef = useRef(null);

  const loadRows = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (batchFilter) params.set('batchId', batchFilter);
      const qs = params.toString();
      const res = await fetch(`/api/admin/labels/imports${qs ? `?${qs}` : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setRows(json.rows || []);
      setListError(null);
    } catch (err) {
      setListError(err.message);
    } finally {
      setLoadingRows(false);
    }
  }, [statusFilter, batchFilter]);

  useEffect(() => { loadRows(); }, [loadRows]);

  useEffect(() => {
    pollRef.current = setInterval(loadRows, 10_000);
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [loadRows]);

  const summary = useMemo(() => {
    const out = Object.fromEntries(LABEL_STATUSES.map(s => [s, 0]));
    for (const r of rows) {
      if (r.status && out[r.status] !== undefined) out[r.status]++;
    }
    return out;
  }, [rows]);

  const batches = useMemo(() => {
    const set = new Set();
    for (const r of rows) if (r.batchId) set.add(r.batchId);
    return Array.from(set).sort().reverse();
  }, [rows]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Label Import</h1>
          <p className="mt-1 text-sm text-gray-600">
            Drop product label files below. The extractor runs on the next cron tick (≤ 5 min)
            and reads SKU, claims, and ingredient doses off the image. Rows that pass
            confidence gates <em>and</em> already have a PCS ID land in
            <span className="mx-1 inline-block rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">Committed</span>
            automatically; everything else waits at
            <span className="ml-1 inline-block rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-800">Needs Validation</span>
            for your review.
          </p>
        </div>
      </header>

      <StageCard onStaged={loadRows} />

      <ErrorLegend />

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        {LABEL_STATUSES.map(s => (
          <div key={s} className="rounded bg-gray-50 px-3 py-2 text-xs">
            <div className="text-gray-500">{s}</div>
            <div className={`mt-0.5 inline-block rounded px-1.5 font-mono text-sm font-medium ${STATUS_STYLES[s] || ''}`}>
              {summary[s] ?? 0}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">All</option>
              {LABEL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Batch:</span>
            <select
              value={batchFilter}
              onChange={e => setBatchFilter(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">All</option>
              {batches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={loadRows}
            className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        {listError && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {listError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">File</th>
                <th className="px-3 py-2 text-left">SKU</th>
                <th className="px-3 py-2 text-left">PCS ID</th>
                <th className="px-3 py-2 text-left">Regulatory</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Actions</th>
                <th className="px-3 py-2 text-left">Confidence</th>
                <th className="px-3 py-2 text-left">Attempts</th>
                <th className="px-3 py-2 text-left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows && rows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400">Loading…</td></tr>
              )}
              {!loadingRows && rows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400">No label intake rows yet.</td></tr>
              )}
              {rows.map(row => (
                <LabelRow key={row.id} row={row} onChanged={loadRows} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function LabelRow({ row, onChanged }) {
  const [sku, setSku] = useState(row.sku || '');
  const [pcsId, setPcsId] = useState(row.pcsId || '');
  const [regulatory, setRegulatory] = useState(row.regulatory || '');
  const [busy, setBusy] = useState(false);
  const [showExtraction, setShowExtraction] = useState(false);

  useEffect(() => { setSku(row.sku || ''); }, [row.sku]);
  useEffect(() => { setPcsId(row.pcsId || ''); }, [row.pcsId]);
  useEffect(() => { setRegulatory(row.regulatory || ''); }, [row.regulatory]);

  const firstFile = row.files?.[0];
  // Wave 5.3.1: no pre-extraction SKU/PCS gate. Operator can queue immediately
  // after staging; extractor fills SKU/product name from the label. PCS ID is
  // optional at Queue time — it's required later to move off Needs Validation.
  const canCommit = ['Pending', 'Needs Validation', 'Failed'].includes(row.status);
  const canCancel = row.status !== 'Committed' && row.status !== 'Cancelled';
  const isReadOnly = row.status === 'Extracting' || row.status === 'Committed';

  async function commit() {
    if (!canCommit) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/labels/imports/${row.id}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: sku.trim(), pcsId: pcsId.trim(), regulatory: regulatory || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`);
      onChanged?.();
    } catch (err) {
      alert(`Commit failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!window.confirm(`Cancel label intake for ${row.sku || row.id}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/labels/imports/${row.id}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || `HTTP ${res.status}`);
      }
      onChanged?.();
    } catch (err) {
      alert(`Cancel failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    if (!window.confirm(
      `Retry ${row.sku || row.id}? This resets status to Pending, clears the extraction,\n` +
      `and re-runs the extractor on the next cron tick (≤ 5 min).`,
    )) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/labels/imports/${row.id}/retry`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`);
      onChanged?.();
    } catch (err) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  // Failed rows + stale Needs Validation rows (where the operator would rather
  // re-extract than hand-correct) benefit from a pure "reset to Pending" path.
  const canRetry = row.status === 'Failed' || row.status === 'Needs Validation';

  return (
    <>
      <tr className="border-t border-gray-100 hover:bg-gray-50">
        <td className="px-3 py-2 text-xs">
          {firstFile?.url
            ? <a href={firstFile.url} target="_blank" rel="noreferrer" className="text-pacific-600 hover:underline">{firstFile.name || 'image'}</a>
            : <span className="text-gray-400">—</span>}
        </td>
        <td className="px-3 py-2">
          <input
            type="text"
            value={sku}
            onChange={e => setSku(e.target.value)}
            disabled={isReadOnly || busy}
            placeholder="01740-EN"
            className="w-28 rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50"
          />
        </td>
        <td className="px-3 py-2">
          <input
            type="text"
            value={pcsId}
            onChange={e => setPcsId(e.target.value)}
            disabled={isReadOnly || busy}
            placeholder="PCS-0137"
            className="w-28 rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50"
          />
        </td>
        <td className="px-3 py-2">
          <select
            value={regulatory}
            onChange={e => setRegulatory(e.target.value)}
            disabled={isReadOnly || busy}
            className="rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50"
          >
            {REGULATORY_OPTIONS.map(o => <option key={o || 'none'} value={o}>{o || '—'}</option>)}
          </select>
        </td>
        <td className="px-3 py-2">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status] || 'bg-gray-100 text-gray-700'}`}>
            {row.status || 'Pending'}
          </span>
        </td>
        <td className="px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={commit}
              disabled={!canCommit || busy}
              className="rounded bg-pacific-600 px-2 py-1 text-xs font-medium text-white hover:bg-pacific-700 disabled:opacity-40"
              title={row.status === 'Needs Validation' && !pcsId.trim() ? 'Add PCS ID before re-queueing to move off Needs Validation' : ''}
            >
              {row.status === 'Pending' && !row.confidenceOverall ? 'Queue' : 'Re-queue'}
            </button>
            {canRetry && (
              <button
                type="button"
                onClick={retry}
                disabled={busy}
                className="rounded border border-amber-400 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-40"
                title="Reset to Pending and re-extract on the next cron tick"
              >
                Retry
              </button>
            )}
            {row.extractionData && (
              <button
                type="button"
                onClick={() => setShowExtraction(v => !v)}
                className="text-pacific-600 hover:underline"
              >
                {showExtraction ? 'Hide' : 'View'}
              </button>
            )}
            {canCancel && (
              <button type="button" onClick={cancel} disabled={busy} className="text-red-600 hover:underline disabled:opacity-40">
                Cancel
              </button>
            )}
          </div>
        </td>
        <td className="px-3 py-2 text-xs font-mono">
          {row.confidenceOverall != null
            ? `${Math.round(row.confidenceOverall * 100)}%`
            : <span className="text-gray-400">—</span>}
        </td>
        <td className="px-3 py-2 text-xs">{row.retryCount ?? 0}</td>
        <td className="px-3 py-2 text-xs text-gray-500">{formatRelative(row.lastEditedTime)}</td>
      </tr>
      {showExtraction && (
        <tr>
          <td colSpan={9} className="bg-gray-50 px-3 py-3">
            <ExtractionDetail rowId={row.id} />
          </td>
        </tr>
      )}
      {row.error && (
        <tr>
          <td colSpan={9} className="bg-red-50 px-3 py-1 text-xs text-red-700">{row.error}</td>
        </tr>
      )}
    </>
  );
}

/**
 * Collapsible legend mapping the errors the operator will most commonly see
 * to the right remediation. Kept close to the table so it's one scroll away
 * when a row fails and the operator doesn't know what the string means.
 */
function ErrorLegend() {
  return (
    <details className="rounded border border-gray-200 bg-blue-50 p-3 text-sm">
      <summary className="cursor-pointer font-medium text-blue-900">
        What do these errors mean? How do I fix them?
      </summary>
      <div className="mt-3 space-y-3 text-xs text-gray-700">
        <div>
          <div className="font-semibold text-gray-900">
            &ldquo;Missing PCS ID — operator must link this label to a PCS before it can go Active.&rdquo;
          </div>
          <div className="mt-0.5">
            <strong>You fix this.</strong> Type the PCS ID (e.g. <code>PCS-0137</code>) in the
            PCS ID field on that row, then click <strong>Re-queue</strong>. The worker will
            re-attempt the commit with the linkage in place.
          </div>
        </div>
        <div>
          <div className="font-semibold text-gray-900">
            &ldquo;active ingredient &lsquo;X&rsquo; dose confidence missing &lt; 0.8&rdquo;
          </div>
          <div className="mt-0.5">
            <strong>You review this.</strong> The extractor wasn&rsquo;t confident about one or
            more ingredient doses. Click <strong>View</strong> to see what it read, compare
            against the label file, then click <strong>Re-queue</strong> to accept
            (recommended) or <strong>Retry</strong> to re-run extraction from scratch.
          </div>
        </div>
        <div>
          <div className="font-semibold text-gray-900">
            &ldquo;body failed validation: …rich_text[0].text.content.length should be ≤ 2000&rdquo;
          </div>
          <div className="mt-0.5">
            <strong>Code bug — now fixed.</strong> Multi-ingredient labels (30+ line
            ingredient panels) blew past Notion&rsquo;s 2000-char rich_text limit. The extractor
            now truncates safely. Click <strong>Retry</strong> on any affected row to
            re-extract.
          </div>
        </div>
        <div className="rounded border border-gray-200 bg-white p-2">
          <div className="font-semibold text-gray-900">Action reference</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li><strong>Queue / Re-queue</strong> — commit the current extraction using the
              SKU, PCS ID, and regulatory framework shown in the row.</li>
            <li><strong>Retry</strong> — reset to <em>Pending</em>, clear the extraction, and
              re-run the extractor on the next cron tick (≤ 5 min).</li>
            <li><strong>View</strong> — expand the raw extraction JSON for auditing.</li>
            <li><strong>Cancel</strong> — mark the row as <em>Cancelled</em>; re-upload if you
              want to try again.</li>
          </ul>
        </div>
      </div>
    </details>
  );
}

function ExtractionDetail({ rowId }) {
  const [detail, setDetail] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/labels/imports/${rowId}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(j => { if (!cancelled) setDetail(j.row); })
      .catch(e => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, [rowId]);

  if (err) return <div className="text-xs text-red-700">{err}</div>;
  if (!detail) return <div className="text-xs text-gray-500">Loading…</div>;
  let parsed = null;
  if (detail.extractionData) {
    try { parsed = JSON.parse(detail.extractionData); } catch { /* raw below */ }
  }
  return (
    <details open className="rounded border border-gray-200 bg-white p-2 text-xs">
      <summary className="cursor-pointer font-medium text-gray-700">Extraction JSON</summary>
      <pre className="mt-2 max-h-96 overflow-auto text-gray-800">
        {parsed ? JSON.stringify(parsed, null, 2) : detail.extractionData || '(empty)'}
      </pre>
    </details>
  );
}

function StageCard({ onStaged }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [rejected, setRejected] = useState([]);
  const [dragDepth, setDragDepth] = useState(0);
  const [progress, setProgress] = useState({});
  const [uploadStatus, setUploadStatus] = useState({});
  const inputRef = useRef(null);

  const isDragging = dragDepth > 0;

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    const accepted = [];
    const rejects = [];
    for (const f of incoming) {
      const ok = /^image\/(png|jpe?g|webp|gif)$/i.test(f.type) ||
                 /\.(png|jpe?g|webp|gif|pdf)$/i.test(f.name) ||
                 f.type === 'application/pdf';
      if (!ok) {
        rejects.push({ name: f.name, reason: 'Unsupported type (PNG/JPG/WEBP/PDF only)' });
      } else if (f.size > 20 * 1024 * 1024) {
        rejects.push({ name: f.name, reason: 'Exceeds 20 MB' });
      } else {
        accepted.push(f);
      }
    }
    setFiles(prev => {
      const seen = new Set(prev.map(f => `${f.name}:${f.size}`));
      const merged = [...prev];
      for (const f of accepted) {
        const key = `${f.name}:${f.size}`;
        if (!seen.has(key)) { merged.push(f); seen.add(key); }
      }
      return merged;
    });
    setRejected(rejects);
    setResult(null);
    setError(null);
  }

  function handleSelect(e) {
    addFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = '';
  }
  function handleDrop(e) { e.preventDefault(); setDragDepth(0); addFiles(e.dataTransfer.files); }
  function handleDragEnter(e) { e.preventDefault(); setDragDepth(d => d + 1); }
  function handleDragLeave(e) { e.preventDefault(); setDragDepth(d => Math.max(0, d - 1)); }
  function handleDragOver(e) { e.preventDefault(); }
  function removeFile(idx) { setFiles(prev => prev.filter((_, i) => i !== idx)); }
  function clearAll() { setFiles([]); setRejected([]); setResult(null); setError(null); if (inputRef.current) inputRef.current.value = ''; }

  async function stage() {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress({});
    setUploadStatus({});

    const uploaded = [];
    const uploadFailures = [];

    await Promise.all(files.map(async (file, idx) => {
      const key = `${file.name}:${file.size}:${idx}`;
      try {
        setUploadStatus(s => ({ ...s, [key]: 'uploading' }));
        const pathname = `label-imports/${file.name}`;
        const tokenResp = await fetch('/api/admin/labels/imports/upload-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pathname }),
        });
        if (!tokenResp.ok) {
          const errBody = await tokenResp.json().catch(() => ({}));
          throw new Error(errBody?.error || `Token request failed: HTTP ${tokenResp.status}`);
        }
        const { token } = await tokenResp.json();

        const [blob, contentHash] = await Promise.all([
          uploadViaXhr(pathname, file, token, (pct) => {
            setProgress(p => ({ ...p, [key]: pct }));
          }),
          sha256Hex(file),
        ]);

        uploaded.push({
          url: blob.url,
          filename: file.name,
          size: file.size,
          contentHash,
        });
        setUploadStatus(s => ({ ...s, [key]: 'done' }));
        setProgress(p => ({ ...p, [key]: 100 }));
      } catch (err) {
        uploadFailures.push({ filename: file.name, error: err?.message || String(err) });
        setUploadStatus(s => ({ ...s, [key]: 'failed' }));
      }
    }));

    if (uploaded.length === 0) {
      setBusy(false);
      setError(uploadFailures.length > 0
        ? `All ${uploadFailures.length} file(s) failed to upload.`
        : 'Upload failed.');
      return;
    }

    try {
      const res = await fetch('/api/admin/labels/imports/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploads: uploaded }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
      if (uploadFailures.length > 0) json.uploadFailures = uploadFailures;
      setResult(json);
      setFiles([]);
      setRejected([]);
      setProgress({});
      setUploadStatus({});
      if (inputRef.current) inputRef.current.value = '';
      onStaged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-medium text-gray-900">Stage label files</h2>
      <p className="mt-1 text-xs text-gray-500">
        PNG / JPG / WEBP / PDF · up to 20 MB each · uploads direct to Vercel Blob.
      </p>

      <div className="mt-4 space-y-4">
        <div
          onClick={() => !busy && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if ((e.key === 'Enter' || e.key === ' ') && !busy) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          aria-label="Drop label files here or click to browse"
          aria-disabled={busy}
          className={[
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer outline-none',
            isDragging
              ? 'border-pacific-500 bg-pacific-50'
              : 'border-gray-300 bg-gray-50 hover:border-pacific-400 hover:bg-pacific-50/40',
            busy ? 'opacity-60 cursor-not-allowed' : '',
            'focus-visible:ring-2 focus-visible:ring-pacific-500 focus-visible:ring-offset-2',
          ].join(' ')}
        >
          <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 7.5m0 0L7.5 12m4.5-4.5V21" />
          </svg>
          <div className="text-sm font-medium text-gray-700">
            {isDragging ? 'Drop label files to add them' : 'Drag label files here, or click to browse'}
          </div>
          <div className="text-xs text-gray-500">PNG / JPG / WEBP / PDF · max 20 MB each</div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
            onChange={handleSelect}
            disabled={busy}
            className="sr-only"
          />
        </div>

        {rejected.length > 0 && (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <div className="font-medium">
              {rejected.length} file{rejected.length === 1 ? '' : 's'} rejected:
            </div>
            <ul className="mt-1 list-disc pl-4">
              {rejected.map((r, i) => (
                <li key={i}><strong>{r.name}</strong> — {r.reason}</li>
              ))}
            </ul>
          </div>
        )}

        {files.length > 0 && (
          <div className="rounded border border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 text-xs text-gray-600">
              <span>
                <strong>{files.length}</strong> file{files.length === 1 ? '' : 's'} ready · total{' '}
                {(files.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024)).toFixed(1)} MB
              </span>
              <button type="button" onClick={clearAll} disabled={busy} className="text-gray-500 hover:text-red-600 disabled:opacity-50">
                Clear all
              </button>
            </div>
            <ul className="max-h-60 overflow-y-auto text-xs">
              {files.map((f, i) => {
                const key = `${f.name}:${f.size}:${i}`;
                const pct = progress[key] ?? 0;
                const st = uploadStatus[key];
                return (
                  <li key={key} className="border-b border-gray-100 px-3 py-1.5 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <span className="truncate pr-3" title={f.name}>{f.name}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {st === 'uploading' && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                            Uploading… {pct}%
                          </span>
                        )}
                        {st === 'done' && (
                          <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                            ✓ Uploaded
                          </span>
                        )}
                        {st === 'failed' && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                            ✕ Failed
                          </span>
                        )}
                        <span className="text-gray-500">{(f.size / 1024).toFixed(0)} KB</span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          disabled={busy}
                          aria-label={`Remove ${f.name}`}
                          className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                        >
                          ✕
                        </button>
                      </span>
                    </div>
                    {(st === 'uploading' || st === 'done') && (
                      <div className="mt-1 h-1 w-full overflow-hidden rounded bg-gray-200">
                        <div
                          className={`h-full transition-all ${st === 'done' ? 'bg-green-500' : 'bg-pacific-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={stage}
            disabled={busy || files.length === 0}
            className="rounded bg-pacific-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-pacific-700 disabled:opacity-50"
          >
            {busy ? 'Uploading…' : `Upload & stage (${files.length})`}
          </button>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {result && (
          <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <div className="font-medium">
              Staged {result.counts?.pending ?? 0} row(s) in batch <code>{result.batchId}</code>
            </div>
            <div className="mt-1 text-xs">
              pending: {result.counts?.pending ?? 0} · duplicate: {result.counts?.duplicate ?? 0} · errored: {result.counts?.errored ?? 0}
            </div>
            {Array.isArray(result.rows) && result.rows.some(r => r.status === 'duplicate') && (
              <ul className="mt-2 list-disc pl-5 text-xs text-gray-700">
                {result.rows.filter(r => r.status === 'duplicate').map((r, i) => (
                  <li key={i}>
                    {r.filename}: dup of {r.duplicate?.priorSku || r.duplicate?.priorRowId} ({r.duplicate?.priorStatus})
                  </li>
                ))}
              </ul>
            )}
            {Array.isArray(result.rows) && result.rows.some(r => r.status === 'errored') && (
              <ul className="mt-2 list-disc pl-5 text-xs text-red-700">
                {result.rows.filter(r => r.status === 'errored').map((r, i) => (
                  <li key={i}>{r.filename}: {r.error}</li>
                ))}
              </ul>
            )}
            {Array.isArray(result.uploadFailures) && result.uploadFailures.length > 0 && (
              <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                <div className="font-medium">
                  {result.uploadFailures.length} file(s) failed to upload and were not staged:
                </div>
                <ul className="mt-1 list-disc pl-5">
                  {result.uploadFailures.map((f, i) => (
                    <li key={i}><strong>{f.filename}</strong>: {f.error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

async function sha256Hex(file) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

function uploadViaXhr(pathname, file, token, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `https://blob.vercel-storage.com/${encodeURI(pathname)}`);
    xhr.setRequestHeader('authorization', `Bearer ${token}`);
    xhr.setRequestHeader('x-content-type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('x-api-version', '7');
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText || '{}');
          resolve({
            url: body.url,
            pathname: body.pathname || pathname,
            contentType: body.contentType || file.type || 'application/octet-stream',
            contentDisposition: body.contentDisposition || '',
          });
        } catch {
          reject(new Error(`Blob PUT succeeded but response body was not JSON: ${xhr.responseText?.slice(0, 200)}`));
        }
      } else {
        reject(new Error(`Blob PUT failed: HTTP ${xhr.status} — ${xhr.responseText?.slice(0, 200)}`));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Network error during Blob PUT')));
    xhr.addEventListener('abort', () => reject(new Error('Blob PUT aborted')));
    xhr.send(file);
  });
}

function formatRelative(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.round((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}
