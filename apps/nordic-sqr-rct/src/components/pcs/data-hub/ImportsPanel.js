'use client';

/**
 * Wave 6.0 Data Hub — Imports panel.
 *
 * Shallow wrap of the body of /pcs/admin/imports so it can be rendered as
 * a tab inside /pcs/data. Zero internal refactor — literally the same
 * dashboard hoisted into a named export. Legacy route still exists as a
 * redirect shim.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import PdfViewer from '@/components/pcs/PdfViewer';

function safeJSONParse(s) { try { return JSON.parse(s); } catch { return null; } }

const STATUSES = ['queued', 'extracting', 'extracted', 'committing', 'committed', 'skipped', 'failed'];
const STATUS_STYLES = {
  queued:     'bg-gray-100 text-gray-700',
  extracting: 'bg-blue-100 text-blue-700',
  extracted:  'bg-indigo-100 text-indigo-700',
  committing: 'bg-amber-100 text-amber-700',
  committed:  'bg-green-100 text-green-700',
  skipped:    'bg-zinc-100 text-zinc-500',
  failed:     'bg-red-100 text-red-700',
};

export default function ImportsPanel() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }
  if (!user) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Sign in required.
      </div>
    );
  }

  return <ImportsDashboard user={user} />;
}

function ImportsDashboard({ user }) {
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [listError, setListError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedDetail, setExpandedDetail] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [currentPromptVersion, setCurrentPromptVersion] = useState(null);
  const [actionOpen, setActionOpen] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/imports/prompt-version', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (!cancelled && j?.current) setCurrentPromptVersion(j.current); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (batchFilter) params.set('batchId', batchFilter);
      const qs = params.toString();
      const res = await fetch(`/api/admin/imports${qs ? `?${qs}` : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setJobs(json.jobs || []);
      setListError(null);
    } catch (err) {
      setListError(err.message);
    } finally {
      setLoadingJobs(false);
    }
  }, [statusFilter, batchFilter]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  useEffect(() => {
    if (expandedId) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(loadJobs, 10_000);
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [expandedId, loadJobs]);

  const summary = useMemo(() => {
    const out = Object.fromEntries(STATUSES.map(s => [s, 0]));
    for (const j of jobs) {
      if (out[j.status] !== undefined) out[j.status]++;
    }
    return out;
  }, [jobs]);

  const templateSummary = useMemo(() => {
    const out = { lauren: 0, partial: 0, legacy: 0, unknown: 0 };
    for (const j of jobs) {
      if (j.status !== 'committed') continue;
      const parsed = safeJSONParse(j.resultCounts);
      const tv = parsed?.templateVersion || 'Unknown';
      if (tv === 'Lauren v1.0') out.lauren++;
      else if (tv === 'Lauren v1.0 partial') out.partial++;
      else if (tv === 'Legacy pre-Lauren') out.legacy++;
      else out.unknown++;
    }
    return out;
  }, [jobs]);

  const batches = useMemo(() => {
    const set = new Set();
    for (const j of jobs) if (j.batchId) set.add(j.batchId);
    return Array.from(set).sort().reverse();
  }, [jobs]);

  async function toggleExpand(job) {
    if (expandedId === job.id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(job.id);
    setExpandedDetail(null);
    try {
      const res = await fetch(`/api/admin/imports/${job.id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setExpandedDetail(json.job);
    } catch (err) {
      setExpandedDetail({ error: err.message });
    }
  }

  async function retryJob(job) {
    if (!window.confirm(`Retry job ${job.jobId}?`)) return;
    const res = await fetch(`/api/admin/imports/${job.id}/retry`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.message || err.error || `HTTP ${res.status}`);
      return;
    }
    loadJobs();
  }

  async function cancelJob(job) {
    if (!window.confirm(`Cancel job ${job.jobId}?`)) return;
    const res = await fetch(`/api/admin/imports/${job.id}/cancel`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.message || err.error || `HTTP ${res.status}`);
      return;
    }
    loadJobs();
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible(checked) {
    setSelectedIds(prev => {
      if (!checked) return new Set();
      return new Set(jobs.map(j => j.id));
    });
  }

  async function bulkReextract() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Create ${ids.length} re-extract job(s)? Only 'committed' sources will be re-queued.`)) return;
    setActionOpen(false);
    try {
      const res = await fetch('/api/admin/imports/bulk-reextract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds: ids }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`);
      const skipped = Array.isArray(json.skipped) ? json.skipped : [];
      const created = Array.isArray(json.newJobIds) ? json.newJobIds.length : 0;
      alert(`Created ${created} new job(s) in batch ${json.newBatchId}. Skipped ${skipped.length}.`);
      setSelectedIds(new Set());
      loadJobs();
    } catch (err) {
      alert(`Bulk re-extract failed: ${err.message}`);
    }
  }

  async function bulkRetry() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Retry ${ids.length} job(s)?`)) return;
    setActionOpen(false);
    const errors = [];
    for (const id of ids) {
      const r = await fetch(`/api/admin/imports/${id}/retry`, { method: 'POST' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        errors.push(`${id.slice(0, 8)}…: ${j.message || j.error || r.status}`);
      }
    }
    if (errors.length > 0) alert(`Completed with ${errors.length} error(s):\n${errors.join('\n')}`);
    setSelectedIds(new Set());
    loadJobs();
  }

  async function bulkCancel() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Cancel ${ids.length} job(s)?`)) return;
    setActionOpen(false);
    const errors = [];
    for (const id of ids) {
      const r = await fetch(`/api/admin/imports/${id}/cancel`, { method: 'POST' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        errors.push(`${id.slice(0, 8)}…: ${j.message || j.error || r.status}`);
      }
    }
    if (errors.length > 0) alert(`Completed with ${errors.length} error(s):\n${errors.join('\n')}`);
    setSelectedIds(new Set());
    loadJobs();
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Batch PCS Import</h1>
          <p className="mt-1 text-sm text-gray-600">
            Upload multiple PCS PDFs at once. A background worker extracts and commits each one;
            this dashboard tracks progress. Processes ~3 per cron tick.
          </p>
        </div>
      </header>

      <StageCard onStaged={loadJobs} />

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-7">
        {STATUSES.map(s => (
          <div key={s} className="rounded bg-gray-50 px-3 py-2 text-xs">
            <div className="text-gray-500 capitalize">{s}</div>
            <div className={`mt-0.5 font-mono text-sm font-medium ${STATUS_STYLES[s] || ''} inline-block px-1.5 rounded`}>
              {summary[s] ?? 0}
            </div>
            {s === 'committed' && (templateSummary.lauren + templateSummary.partial + templateSummary.legacy + templateSummary.unknown) > 0 && (
              <div className="mt-1 text-[10px] text-gray-500" title="Template version breakdown">
                {templateSummary.lauren}L · {templateSummary.partial}P · {templateSummary.legacy}Lg · {templateSummary.unknown}U
              </div>
            )}
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
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
            onClick={loadJobs}
            className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
          {expandedId && (
            <span className="text-xs text-amber-600">Polling paused while detail is open.</span>
          )}
          {selectedIds.size > 0 && (
            <div className="relative ml-auto">
              <button
                type="button"
                onClick={() => setActionOpen(v => !v)}
                className="rounded bg-pacific-600 px-3 py-1 text-sm font-medium text-white hover:bg-pacific-700"
              >
                Actions ({selectedIds.size}) ▼
              </button>
              {actionOpen && (
                <div className="absolute right-0 z-10 mt-1 w-56 rounded border border-gray-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={bulkReextract}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Re-extract selected
                  </button>
                  <button
                    type="button"
                    onClick={bulkRetry}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Retry selected
                  </button>
                  <button
                    type="button"
                    onClick={bulkCancel}
                    className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
                  >
                    Cancel selected
                  </button>
                </div>
              )}
            </div>
          )}
          {currentPromptVersion && (
            <span className="ml-auto text-xs text-gray-500">
              Current prompt: <code className="font-mono">{currentPromptVersion}</code>
            </span>
          )}
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
                <th className="px-2 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={jobs.length > 0 && selectedIds.size === jobs.length}
                    onChange={e => selectAllVisible(e.target.checked)}
                    aria-label="Select all visible"
                  />
                </th>
                <th className="px-3 py-2 text-left">Job ID</th>
                <th className="px-3 py-2 text-left">PCS ID</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Counts</th>
                <th className="px-3 py-2 text-left">Prompt v</th>
                <th className="px-3 py-2 text-left">Template</th>
                <th className="px-3 py-2 text-left">Retry</th>
                <th className="px-3 py-2 text-left">Updated</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingJobs && jobs.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-400">Loading…</td></tr>
              )}
              {!loadingJobs && jobs.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-400">No jobs yet.</td></tr>
              )}
              {jobs.map(job => (
                <JobRow
                  key={job.id}
                  job={job}
                  expanded={expandedId === job.id}
                  detail={expandedId === job.id ? expandedDetail : null}
                  selected={selectedIds.has(job.id)}
                  onSelect={() => toggleSelect(job.id)}
                  currentPromptVersion={currentPromptVersion}
                  onToggle={() => toggleExpand(job)}
                  onRetry={() => retryJob(job)}
                  onCancel={() => cancelJob(job)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StageCard({ onStaged }) {
  const [files, setFiles] = useState([]);
  const [conflictAction, setConflictAction] = useState('skip');
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
    // Wave 3.8 — accept PDF or Word .docx. Legacy binary .doc is explicitly
    // called out with a more actionable rejection reason.
    const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    for (const f of incoming) {
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      const isDocx = f.type === MIME_DOCX || /\.docx$/i.test(f.name);
      const isLegacyDoc = /\.doc$/i.test(f.name) && !isDocx;
      if (isLegacyDoc) {
        rejects.push({ name: f.name, reason: "Legacy .doc files aren't supported — save as .docx and re-upload" });
      } else if (!isPdf && !isDocx) {
        rejects.push({ name: f.name, reason: 'Not a PDF or Word .docx' });
      } else if (f.size > 20 * 1024 * 1024) {
        rejects.push({ name: f.name, reason: 'Exceeds 20 MB limit' });
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

  // Wave 3.8 — render a small format badge next to each staged file so
  // operators can tell at a glance which files took the PDF vs DOCX branch.
  function fileBadge(f) {
    const isDocx = f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || /\.docx$/i.test(f.name);
    if (isDocx) {
      return (
        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700" title="Word document">
          📘 DOCX
        </span>
      );
    }
    return (
      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700" title="PDF">
        📄 PDF
      </span>
    );
  }

  function handleSelect(e) {
    addFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragDepth(0);
    addFiles(e.dataTransfer.files);
  }

  function handleDragEnter(e) {
    e.preventDefault();
    setDragDepth(d => d + 1);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setDragDepth(d => Math.max(0, d - 1));
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  function clearAll() {
    setFiles([]);
    setRejected([]);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

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
        const pathname = `pcs-imports/${file.name}`;
        const tokenResp = await fetch('/api/admin/imports/upload-token', {
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
        ? `All ${uploadFailures.length} file(s) failed to upload: ${uploadFailures.map(f => f.filename).join(', ')}`
        : 'Upload failed');
      return;
    }

    try {
      const res = await fetch('/api/admin/imports/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploads: uploaded, conflictAction }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
      if (uploadFailures.length > 0) {
        json.uploadFailures = uploadFailures;
      }
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
      <h2 className="text-lg font-medium text-gray-900">Stage a batch</h2>
      <p className="mt-1 text-sm text-gray-600">
        Select one or more PCS documents — PDF or Word (.docx) — max 20 MB each. Filename must start with <code>PCS-NNNN</code> for
        dedup to work. Files are uploaded to Vercel Blob and queued for the worker.
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
          aria-label="Drop PCS PDFs or Word .docx files here, or click to browse"
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
            {isDragging ? 'Drop files to add them to the batch' : 'Drag PCS documents here, or click to browse'}
          </div>
          <div className="text-xs text-gray-500">
            Multiple files OK · PDF or Word (.docx) · max 20 MB each
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
              <button
                type="button"
                onClick={clearAll}
                disabled={busy}
                className="text-gray-500 hover:text-red-600 disabled:opacity-50"
              >
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
                      <span className="flex min-w-0 items-center gap-2 pr-3">
                        {fileBadge(f)}
                        <span className="truncate" title={f.name}>{f.name}</span>
                      </span>
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
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">On duplicate PCS:</span>
            <select
              value={conflictAction}
              onChange={e => setConflictAction(e.target.value)}
              disabled={busy}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="skip">Skip (don't re-import)</option>
              <option value="link">Link (update existing doc)</option>
            </select>
          </label>
          <button
            type="button"
            onClick={stage}
            disabled={busy || files.length === 0}
            className="rounded bg-pacific-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-pacific-700 disabled:opacity-50"
          >
            {busy ? 'Uploading…' : `Upload & queue (${files.length})`}
          </button>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <div className="font-medium">
              Staged {result.counts?.queued ?? 0} job(s) — est. cost {result.estimatedCost?.total ?? '—'} across {result.pageCount ?? 0} pages
              {' · '}batch <code>{result.batchId}</code>
            </div>
            <div className="mt-1 text-xs">
              queued: {result.counts?.queued ?? 0} · skipped: {result.counts?.skipped ?? 0} · errored: {result.counts?.errored ?? 0}
              {result.estimatedCost?.savedFromDedup && result.estimatedCost.savedFromDedup !== '$0.00' && (
                <> · saved {result.estimatedCost.savedFromDedup} via content-hash dedup</>
              )}
            </div>
            {Array.isArray(result.jobs) && result.jobs.some(j => j.dedup) && (
              <ul className="mt-2 list-disc pl-5 text-xs text-gray-700">
                {result.jobs.filter(j => j.dedup).map((j, i) => (
                  <li key={i}>
                    {j.filename}: identical content previously imported (job {j.dedup.priorJobId}, batch {j.dedup.priorBatchId})
                  </li>
                ))}
              </ul>
            )}
            {Array.isArray(result.jobs) && result.jobs.some(j => j.error) && (
              <ul className="mt-2 list-disc pl-5 text-xs text-red-700">
                {result.jobs.filter(j => j.error).map((j, i) => (
                  <li key={i}>{j.filename}: {j.error}</li>
                ))}
              </ul>
            )}
            {Array.isArray(result.uploadFailures) && result.uploadFailures.length > 0 && (
              <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                <div className="font-medium">
                  {result.uploadFailures.length} file(s) failed to upload and were not queued:
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

function JobRow({ job, expanded, detail, selected, onSelect, currentPromptVersion, onToggle, onRetry, onCancel }) {
  let counts = null;
  if (job.resultCounts) {
    try { counts = JSON.parse(job.resultCounts); } catch { /* ignore */ }
  }
  const canRetry = job.status === 'failed';
  const canCancel = job.status === 'queued';
  const jobPromptV = job.promptVersion || '';
  const isOutdated = currentPromptVersion && jobPromptV && jobPromptV !== currentPromptVersion;

  return (
    <>
      <tr className="border-t border-gray-100 hover:bg-gray-50">
        <td className="px-2 py-2">
          <input
            type="checkbox"
            checked={!!selected}
            onChange={onSelect}
            aria-label={`Select ${job.jobId}`}
          />
        </td>
        <td className="px-3 py-2 font-mono text-xs">{job.jobId}</td>
        <td className="px-3 py-2">{job.pcsId || <span className="text-gray-400">—</span>}</td>
        <td className="px-3 py-2">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[job.status] || 'bg-gray-100 text-gray-700'}`}>
            {job.status || 'unknown'}
          </span>
        </td>
        <td className="px-3 py-2 text-xs">
          {counts
            ? `${counts.claims ?? 0}c · ${counts.formulaLines ?? 0}fl · ${counts.references ?? 0}r · ${counts.evidencePackets ?? 0}ev`
            : <span className="text-gray-400">—</span>}
        </td>
        <td className={`px-3 py-2 text-xs font-mono ${isOutdated ? 'bg-yellow-100' : ''}`} title={isOutdated ? `Outdated — current is ${currentPromptVersion}` : undefined}>
          {jobPromptV
            ? (isOutdated ? `⚠️ ${jobPromptV}` : jobPromptV)
            : <span className="text-gray-400">—</span>}
        </td>
        <td className="px-2 py-2">
          {(() => {
            const tv = counts?.templateVersion;
            if (!tv || job.status !== 'committed') return <span className="text-gray-400">—</span>;
            const STYLE = {
              'Lauren v1.0':         'bg-green-100 text-green-700',
              'Lauren v1.0 partial': 'bg-yellow-100 text-yellow-800',
              'Legacy pre-Lauren':   'bg-red-100 text-red-700',
              'Unknown':             'bg-gray-100 text-gray-600',
            }[tv] || 'bg-gray-100 text-gray-600';
            const LABEL = { 'Lauren v1.0': 'Lauren', 'Lauren v1.0 partial': 'Partial', 'Legacy pre-Lauren': 'Legacy', 'Unknown': 'Unknown' }[tv] || tv;
            return <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${STYLE}`} title={tv}>{LABEL}</span>;
          })()}
        </td>
        <td className="px-3 py-2 text-xs">{job.retryCount ?? 0}</td>
        <td className="px-3 py-2 text-xs text-gray-500">{formatRelative(job.lastEditedTime)}</td>
        <td className="px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onToggle} className="text-pacific-600 hover:underline">
              {expanded ? 'Hide' : 'View'}
            </button>
            {canRetry && (
              <button type="button" onClick={onRetry} className="text-amber-600 hover:underline">Retry</button>
            )}
            {canCancel && (
              <button type="button" onClick={onCancel} className="text-red-600 hover:underline">Cancel</button>
            )}
            {job.pdfUrl && (
              <a href={job.pdfUrl} target="_blank" rel="noreferrer" className="text-gray-500 hover:underline">PDF</a>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={10} className="bg-gray-50 px-3 py-3">
            <JobDetail job={job} detail={detail} />
          </td>
        </tr>
      )}
    </>
  );
}

function JobDetail({ job, detail }) {
  if (!detail) {
    return <div className="text-xs text-gray-500">Loading detail…</div>;
  }
  if (detail.error) {
    return <div className="text-xs text-red-700">{detail.error}</div>;
  }
  let parsed = null;
  if (detail.extractedData) {
    try { parsed = JSON.parse(detail.extractedData); } catch { /* keep raw */ }
  }
  return (
    <div className="space-y-3 text-xs">
      {detail.pdfUrl && (
        <div className="h-[60vh] overflow-hidden rounded border border-gray-200 bg-white">
          <PdfViewer src={detail.pdfUrl} page={1} className="h-full" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KV label="Batch" value={detail.batchId} mono />
        <KV label="Owner" value={detail.ownerEmail} />
        <KV label="Conflict" value={detail.conflictAction} />
        <KV label="Existing Doc" value={detail.existingDocId ? detail.existingDocId.slice(0, 8) + '…' : '—'} mono />
        <KV label="Prompt v" value={detail.promptVersion || '—'} mono />
        <KV label="Content hash" value={detail.contentHash ? detail.contentHash.slice(0, 12) + '…' : '—'} mono />
      </div>
      {detail.error && detail.status !== 'skipped' && (
        <Block label="Error" tone="red">{detail.error}</Block>
      )}
      {detail.warnings && (
        <Block label={`Warnings`} tone="amber">
          <ul className="list-disc pl-5">
            {detail.warnings.split('\n').filter(Boolean).map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </Block>
      )}
      {detail.createdDocumentId && (
        <Block label="Created document" tone="green">
          <code>{detail.createdDocumentId}</code>
        </Block>
      )}
      {parsed && (
        <>
          {(() => {
            const all = [
              ...((parsed.claims || []).map(c => ({ kind: 'claim', label: `Claim ${c.claimNo ?? ''}: ${c.claim || ''}`, confidence: c.confidence }))),
              ...((parsed.formulaLines || []).map(f => ({ kind: 'formula', label: f.ai || f.ingredientForm || 'Formula', confidence: f.confidence }))),
              ...((parsed.evidencePackets || []).map(e => ({ kind: 'evidence', label: e.keyTakeaway?.slice(0, 80) || e.name || 'Evidence', confidence: e.confidence }))),
            ];
            const low = all.filter(i => typeof i.confidence === 'number' && i.confidence < 0.7);
            if (low.length === 0) return null;
            return (
              <div className="rounded border-l-4 border-yellow-400 border-y border-r border-yellow-200 bg-yellow-50 p-2 text-yellow-800">
                <div className="mb-1 text-[10px] font-semibold uppercase">
                  ⚠️ {low.length} low-confidence item{low.length === 1 ? '' : 's'}
                </div>
                <ul className="list-disc pl-5">
                  {low.map((i, idx) => (
                    <li key={idx}>
                      <span className="font-mono">{Math.round(i.confidence * 100)}%</span>
                      <span className="mx-1 text-gray-500">[{i.kind}]</span>
                      {i.label}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
          <VersionDiff diff={detail.diffReport} />
          <details className="rounded border border-gray-200 bg-white p-2">
            <summary className="cursor-pointer font-medium text-gray-700">Extracted data ({detail.extractedData.length.toLocaleString()} chars)</summary>
            <pre className="mt-2 max-h-96 overflow-auto text-xs text-gray-800">
              {JSON.stringify(parsed, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}

function VersionDiff({ diff }) {
  if (!diff) return null;
  const claims = diff.claims || { added: [], removed: [], modified: [] };
  const formula = diff.formulaLines || { added: [], removed: [], modified: [] };
  const doc = diff.document || { changedFields: [] };
  const total = (claims.added?.length || 0) + (claims.removed?.length || 0) + (claims.modified?.length || 0)
    + (formula.added?.length || 0) + (formula.removed?.length || 0) + (formula.modified?.length || 0)
    + (doc.changedFields?.length || 0);
  if (total === 0) return null;

  const fmtVal = v => {
    if (v === null || v === undefined || v === '') return '∅';
    if (Array.isArray(v)) return `[${v.join(', ')}]`;
    return String(v);
  };

  const Section = ({ title, added, removed, modified, renderItem, renderMod }) => (
    <div className="rounded border border-gray-200 bg-white p-2">
      <div className="mb-1 text-[10px] font-semibold uppercase text-gray-600">{title}</div>
      {(added?.length || 0) + (removed?.length || 0) + (modified?.length || 0) === 0 ? (
        <div className="text-gray-400">No changes</div>
      ) : (
        <div className="space-y-1">
          {(added || []).map((item, i) => (
            <div key={`a${i}`} className="rounded border-l-4 border-green-400 bg-green-50 px-2 py-1 text-green-900">
              <span className="mr-1 font-semibold">➕</span>{renderItem(item)}
            </div>
          ))}
          {(removed || []).map((item, i) => (
            <div key={`r${i}`} className="rounded border-l-4 border-red-400 bg-red-50 px-2 py-1 text-red-900">
              <span className="mr-1 font-semibold">➖</span>{renderItem(item)}
            </div>
          ))}
          {(modified || []).map((m, i) => (
            <div key={`m${i}`} className="rounded border-l-4 border-yellow-400 bg-yellow-50 px-2 py-1 text-yellow-900">
              <span className="mr-1 font-semibold">≈</span>{renderMod(m)}
              {m.changes && m.changes.length > 0 && (
                <ul className="mt-1 list-disc pl-6 text-[11px] text-yellow-800">
                  {m.changes.map((c, j) => <li key={j}><code>{c}</code></li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <details className="rounded border border-blue-200 bg-white p-2" open>
      <summary className="cursor-pointer font-medium text-blue-800">🔄 Version diff</summary>
      <div className="mt-2 space-y-2">
        <div className="rounded border-l-4 border-blue-400 border-y border-r border-blue-200 bg-blue-50 p-2 text-blue-900">
          <div className="font-bold">{diff.summary}</div>
          {diff.truncated && (
            <div className="mt-1 text-[11px] text-blue-700">(Large diff — showing top 100 items per category.)</div>
          )}
        </div>
        <Section
          title="Claims"
          added={claims.added}
          removed={claims.removed}
          modified={claims.modified}
          renderItem={c => (
            <span>
              {c.claimNo != null && <span className="mr-1 font-mono text-[10px] text-gray-500">#{c.claimNo}</span>}
              {c.claimBucket && <span className="mr-1 rounded bg-gray-200 px-1 text-[10px]">{c.claimBucket}</span>}
              <span>{c.claim}</span>
            </span>
          )}
          renderMod={m => (
            <span>
              {m.before?.claimNo != null && <span className="mr-1 font-mono text-[10px] text-gray-500">#{m.before.claimNo}</span>}
              <span>{m.before?.claim || m.after?.claim}</span>
            </span>
          )}
        />
        <Section
          title="Formula lines"
          added={formula.added}
          removed={formula.removed}
          modified={formula.modified}
          renderItem={f => (
            <span>
              <strong>{f.ai || '?'}</strong>
              {f.aiForm ? <span className="text-gray-600"> ({f.aiForm})</span> : null}
              {f.amountPerServing != null && (
                <span className="ml-2 font-mono text-[11px]">{f.amountPerServing}{f.amountUnit ? ` ${f.amountUnit}` : ''}</span>
              )}
            </span>
          )}
          renderMod={m => (
            <span>
              <strong>{m.before?.ai || m.after?.ai || '?'}</strong>
              {(m.before?.aiForm || m.after?.aiForm) && (
                <span className="text-gray-600"> ({m.before?.aiForm || m.after?.aiForm})</span>
              )}
            </span>
          )}
        />
        <div className="rounded border border-gray-200 bg-white p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase text-gray-600">Document</div>
          {(doc.changedFields?.length || 0) === 0 ? (
            <div className="text-gray-400">No changes</div>
          ) : (
            <ul className="space-y-1">
              {doc.changedFields.map((c, i) => (
                <li key={i} className="rounded border-l-4 border-yellow-400 bg-yellow-50 px-2 py-1 text-yellow-900">
                  <span className="mr-1 font-semibold">≈</span>
                  <code>{c.field}</code>: {fmtVal(c.before)} → {fmtVal(c.after)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}

function KV({ label, value, mono }) {
  return (
    <div className="rounded bg-white px-2 py-1">
      <div className="text-[10px] uppercase text-gray-400">{label}</div>
      <div className={`mt-0.5 ${mono ? 'font-mono' : ''} text-gray-800`}>{value || '—'}</div>
    </div>
  );
}

function Block({ label, tone = 'gray', children }) {
  const toneMap = {
    red: 'border-red-200 bg-red-50 text-red-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    green: 'border-green-200 bg-green-50 text-green-800',
    gray: 'border-gray-200 bg-white text-gray-700',
  };
  return (
    <div className={`rounded border p-2 ${toneMap[tone]}`}>
      <div className="mb-1 text-[10px] font-semibold uppercase">{label}</div>
      <div>{children}</div>
    </div>
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
    // Wave 3.8 — DOCX files may arrive without a browser-set type (older
    // browsers) so infer from extension as a fallback. The upload-token
    // route enforces the allow-list server-side either way.
    const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const inferred = /\.docx$/i.test(file.name) ? DOCX_MIME : 'application/pdf';
    xhr.setRequestHeader('x-content-type', file.type || inferred);
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
            contentType: body.contentType || 'application/pdf',
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
