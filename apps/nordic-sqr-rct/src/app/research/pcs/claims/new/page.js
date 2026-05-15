'use client';

/**
 * /pcs/claims/new — Bundle 4 Phase 2 (form-driven entry, live).
 *
 * Two entry surfaces side-by-side:
 *   1. Form-driven entry — controlled-vocab dropdowns + structured submit.
 *      Posts to /api/pcs/claims/from-form, which composes the existing
 *      createClaim() contract from the form payload and stashes the
 *      structured form data as JSON in documentNotes for future-phase
 *      relational backfill.
 *   2. Upload .docx (existing fallback) — links into the data-hub imports
 *      tab, the prior production path for adding claims.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PcsClaimFormFields from '@/components/pcs/forms/PcsClaimFormFields';

const TAB_FORM = 'form';
const TAB_UPLOAD = 'upload';

export default function NewPcsClaimPage() {
  const [tab, setTab] = useState(TAB_UPLOAD);
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New PCS claim</h1>
        <p className="mt-1 text-sm text-gray-500">
          Add a claim either by uploading a .docx (the established production path)
          or by entering it directly with controlled-vocabulary dropdowns.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-4" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setTab(TAB_UPLOAD)}
            className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
              tab === TAB_UPLOAD
                ? 'border-pacific-500 text-pacific-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
            aria-current={tab === TAB_UPLOAD ? 'page' : undefined}
          >
            Upload .docx
          </button>
          <button
            type="button"
            onClick={() => setTab(TAB_FORM)}
            className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
              tab === TAB_FORM
                ? 'border-pacific-500 text-pacific-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
            aria-current={tab === TAB_FORM ? 'page' : undefined}
          >
            Form-driven entry
            <span className="ml-1 rounded bg-green-100 px-1 py-0.5 text-[10px] font-medium text-green-800">live</span>
          </button>
        </nav>
      </div>

      {tab === TAB_UPLOAD && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>
            Document upload lives in the Data Hub imports tab. Use the link below to upload a PCS .docx; claims are extracted and committed there.
          </p>
          <Link
            href="/research/pcs/data?tab=imports"
            className="mt-3 inline-block rounded-md bg-pacific-600 px-4 py-2 text-sm font-medium text-white hover:bg-pacific-700"
          >
            Go to Imports
          </Link>
        </div>
      )}

      {tab === TAB_FORM && <FormEntryPanel router={router} />}
    </div>
  );
}

function FormEntryPanel({ router }) {
  const [pcsDocs, setPcsDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docId, setDocId] = useState('');
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionId, setVersionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setDocsLoading(true); });
    fetch('/api/pcs/documents')
      .then(async (r) => (r.ok ? r.json() : []))
      .then((d) => { if (!cancelled) setPcsDocs(Array.isArray(d) ? d : []); })
      .finally(() => { if (!cancelled) setDocsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!docId) {
      queueMicrotask(() => { if (!cancelled) { setVersions([]); setVersionId(''); } });
      return () => { cancelled = true; };
    }
    queueMicrotask(() => { if (!cancelled) setVersionsLoading(true); });
    fetch(`/api/pcs/versions?documentId=${encodeURIComponent(docId)}`)
      .then(async (r) => (r.ok ? r.json() : []))
      .then((v) => {
        if (cancelled) return;
        const list = Array.isArray(v) ? v : [];
        setVersions(list);
        // Auto-select latest if available.
        const latest = list.find((x) => x.isLatest) || list[0];
        if (latest) setVersionId(latest.id);
      })
      .finally(() => { if (!cancelled) setVersionsLoading(false); });
    return () => { cancelled = true; };
  }, [docId]);

  async function handleFormSubmit(payload) {
    setError(null);
    setSuccess(null);
    if (!versionId) {
      setError('Pick a target PCS document and version before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/pcs/claims/from-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, pcsVersionId: versionId }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`);
      setSuccess(`Claim created (id: ${body.id || 'unknown'}). Redirecting...`);
      // Redirect to the claim detail (or back to claims list if route absent).
      setTimeout(() => {
        if (body.id) router.push(`/pcs/claims/${body.id}`);
        else router.push('/research/pcs/claims');
      }, 800);
    } catch (err) {
      setError(`Submit failed: ${err?.message || 'unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        Form-driven entry is now live. Active ingredient and prefix dropdowns remain empty until cv_active_ingredients import lands; for now, type the AI/prefix into the claim text directly.
      </div>

      <div className="rounded-md border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Target PCS version</h2>
        <p className="text-xs text-gray-500">Pick which PCS document + version this new claim attaches to.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">PCS document</span>
            <select
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              disabled={docsLoading || submitting}
              className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded-md bg-white"
            >
              <option value="">{docsLoading ? 'Loading…' : '— Select PCS doc —'}</option>
              {pcsDocs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.pcsId || '(no id)'}{d.finishedGoodName ? ` — ${d.finishedGoodName}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Version</span>
            <select
              value={versionId}
              onChange={(e) => setVersionId(e.target.value)}
              disabled={!docId || versionsLoading || submitting}
              className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded-md bg-white"
            >
              <option value="">{!docId ? 'Pick a doc first' : versionsLoading ? 'Loading…' : '— Select version —'}</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version || '(no version)'}{v.isLatest ? ' (latest)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <PcsClaimFormFields onSubmit={handleFormSubmit} busy={submitting} />

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>
      ) : null}
    </div>
  );
}
