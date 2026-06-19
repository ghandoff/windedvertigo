'use client';

/**
 * Bundle 3 Phase 3.3 — AICS detail page.
 *
 * Renders one AICS document with four tabs:
 *   1. Cover — doc revision history table
 *   2. Raw Materials — Table A (FM PLM# / AI Source / AI Form / AI)
 *   3. Claims — list of aics_claims (claim text + min dose by demographic + grade)
 *   4. Regulatory — placeholder card; substantiation studies wiring is Phase 3.5+
 *
 * Cap-gated edit affordance for RA / admin / super-user via `aics.documents:edit`
 * and `aics.claims:edit`. Researcher reads-only.
 *
 * Env-not-set graceful state: when the underlying Notion AICS databases
 * aren't provisioned, the page renders a config-pending card rather than
 * crashing on the API error.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { can } from '@/lib/auth/capabilities';

// ─── Propagation modal ──────────────────────────────────────────────────────

function PropagateModal({ aicsDocId, claim, onClose, onSuccess }) {
  const [step, setStep] = useState('loading'); // loading | preview | done | error
  const [preview, setPreview] = useState(null);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    fetch(`/api/pcs/aics/${aicsDocId}/claims/${claim.id}/propagate?dryRun=true`, {
      method: 'POST',
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        setPreview(body);
        setStep('preview');
      })
      .catch((err) => {
        setErrorMsg(err.message);
        setStep('error');
      });
  }, [aicsDocId, claim.id]);

  async function handleConfirm() {
    setWorking(true);
    try {
      const res = await fetch(`/api/pcs/aics/${aicsDocId}/claims/${claim.id}/propagate`, {
        method: 'POST',
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setResult(body);
      setStep('done');
      if (typeof onSuccess === 'function') onSuccess(body);
    } catch (err) {
      setErrorMsg(err.message);
      setStep('error');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Propagate claim to PCS documents</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
            <span className="font-medium text-gray-500 text-xs uppercase block mb-1">Claim being propagated</span>
            {claim.claimText || <span className="italic text-gray-400">(no claim text)</span>}
            {claim.minDose !== null && claim.minDose !== undefined && (
              <span className="block mt-1 text-xs text-gray-500">
                Min dose: {claim.minDose} {claim.minDoseUnit || 'mg'}
              </span>
            )}
          </div>

          {step === 'loading' && (
            <p className="text-sm text-gray-500 py-4 text-center">Finding qualifying products…</p>
          )}

          {step === 'error' && (
            <div className="text-sm text-red-600 py-2">
              <span className="font-medium">Error: </span>{errorMsg}
            </div>
          )}

          {step === 'preview' && preview && (
            <>
              <p className="text-sm text-gray-600 mb-3">
                This will push the claim to{' '}
                <span className="font-semibold text-gray-900">
                  {preview.count} product{preview.count !== 1 ? 's' : ''}
                </span>
                {preview.ingredient && (
                  <span className="text-gray-500"> containing {preview.ingredient.name}</span>
                )}.
              </p>
              {preview.count === 0 && (
                <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                  No qualifying products found — either no formula lines meet the dose threshold, or all matching products already have this claim.
                </p>
              )}
              {preview.documents?.length > 0 && (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 text-sm">
                  {preview.documents.map((d) => (
                    <div key={d.pcsDocumentId} className="px-4 py-2.5 flex items-center justify-between">
                      <span className="text-gray-600 text-xs font-mono truncate max-w-[200px]">{d.pcsDocumentId}</span>
                      <span className="text-gray-500 text-xs">
                        {d.currentVersion || '—'} → <span className="text-green-700 font-medium">{d.newVersion}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {preview.skipped?.length > 0 && (
                <p className="text-xs text-gray-400 mt-3">
                  {preview.skipped.length} product{preview.skipped.length !== 1 ? 's' : ''} already have this claim.
                </p>
              )}
            </>
          )}

          {step === 'done' && result && (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✓</div>
              <p className="text-base font-semibold text-gray-900">
                Propagated to {result.propagated} product{result.propagated !== 1 ? 's' : ''}
              </p>
              {result.errors?.length > 0 && (
                <p className="text-sm text-red-600 mt-2">{result.errors.length} failed — check logs</p>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          {step === 'done' ? (
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-pacific-600 text-white hover:bg-pacific-700"
            >
              Close
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={working}
                className="px-4 py-1.5 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              {step === 'preview' && preview?.count > 0 && (
                <button
                  onClick={handleConfirm}
                  disabled={working}
                  className="px-4 py-1.5 text-sm font-medium rounded-md bg-pacific-600 text-white hover:bg-pacific-700 disabled:opacity-50"
                >
                  {working ? 'Propagating…' : `Confirm — push to ${preview.count} product${preview.count !== 1 ? 's' : ''}`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'cover',         label: 'Cover'         },
  { key: 'raw-materials', label: 'Raw Materials' },
  { key: 'claims',        label: 'Claims'        },
  { key: 'regulatory',    label: 'Regulatory'    },
];

export default function AicsDetailPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const { user } = useAuth();

  const [doc, setDoc] = useState(null);
  const [claims, setClaims] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(null);
  const [activeTab, setActiveTab] = useState('cover');
  const [modalClaim, setModalClaim] = useState(null);
  const [propagatedClaimIds, setPropagatedClaimIds] = useState(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteStatus, setDeleteStatus] = useState(null); // null | 'submitting' | 'sent' | 'error'

  const handleApiError = useCallback((err) => {
    const msg = err?.message || '';
    if (msg.includes('NOTION_AICS') || msg.includes('database_id') || msg.includes('AICS')) {
      setConfigError(
        'AICS Library is on the platform roadmap (DDL + API + sidebar shipped 2026-05-03) but the Notion databases are not yet provisioned. Contact the platform admin.',
      );
    } else {
      setConfigError(`Failed to load AICS doc: ${msg}`);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/pcs/aics/${id}`).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
        return r.json();
      }),
      fetch(`/api/pcs/aics/${id}/claims`).then(async (r) => {
        if (!r.ok) return { versionId: null, items: [] };
        return r.json();
      }),
      fetch(`/api/pcs/aics/${id}/versions`).then(async (r) => {
        if (!r.ok) return [];
        return r.json();
      }),
    ])
      .then(([d, c, v]) => {
        setDoc(d);
        // Claims API returns { versionId, items: [...] }
        setClaims(Array.isArray(c) ? c : (Array.isArray(c?.items) ? c.items : []));
        setVersions(Array.isArray(v) ? v : []);
      })
      .catch(handleApiError)
      .finally(() => setLoading(false));
  }, [id, handleApiError]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="text-xs text-gray-500">PCS / AICS / loading...</div>
        <div className="animate-pulse h-8 w-72 bg-gray-200 rounded" />
        <div className="animate-pulse h-40 bg-gray-200 rounded" />
      </div>
    );
  }

  if (configError) {
    return (
      <div className="space-y-4">
        <div className="text-xs text-gray-500">
          <Link href="/research/pcs/aics" className="hover:text-pacific">PCS · AICS</Link>
          <span className="mx-1">/</span>
          <span className="text-gray-700">{id}</span>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-6">
          <div className="text-sm text-amber-900">
            <p className="font-semibold mb-1">AICS configuration pending</p>
            <p className="mb-2">{configError}</p>
            <p className="text-xs text-amber-800">
              Schema reference: <code className="bg-amber-100 px-1 py-0.5 rounded">db/migrations/003_aics_entity_ddl.sql</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="text-center py-16 text-gray-500">
        AICS document not found. <Link href="/research/pcs/aics" className="text-pacific-600 hover:underline">Back to library</Link>
      </div>
    );
  }

  const canEdit = can(user, 'aics.documents:edit');

  async function submitDeleteRequest() {
    if (!deleteReason.trim()) return;
    setDeleteStatus('submitting');
    try {
      const res = await fetch('/api/pcs/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request: `Delete request: AICS Document — ${doc.aicsId || id}`,
          requestType: 'Delete',
          requestNotes: deleteReason.trim(),
          specificField: `/research/pcs/aics/${id}`,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setDeleteStatus('sent');
    } catch {
      setDeleteStatus('error');
    }
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb + header */}
      <div>
        <div className="text-xs text-gray-500 mb-1">
          <Link href="/research/pcs/aics" className="hover:text-pacific">PCS · AICS</Link>
          <span className="mx-1">/</span>
          <span className="text-gray-700">{doc.aicsId || id}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">
            {doc.aicsId || 'AICS'}
            {doc.aiName ? <span className="text-gray-600 font-normal ml-2">— {doc.aiName}</span> : null}
          </h1>
          <div className="flex items-center gap-2 text-xs">
            {doc.raReviewStatus ? (
              <span className={`inline-block px-2.5 py-1 rounded-full font-medium ${
                doc.raReviewStatus === 'Approved' ? 'bg-green-100 text-green-700'
                  : doc.raReviewStatus === 'Pending RA Review' ? 'bg-yellow-100 text-yellow-700'
                  : doc.raReviewStatus === 'Rejected' ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {doc.raReviewStatus}
              </span>
            ) : null}
            {doc.approvedDate ? (
              <span className="text-gray-500">Approved {doc.approvedDate}</span>
            ) : null}
            {canEdit && deleteStatus !== 'sent' && (
              <button
                type="button"
                onClick={() => setDeleteOpen(o => !o)}
                className="ml-2 text-xs text-red-500 hover:text-red-700 transition"
              >
                {deleteOpen ? 'Cancel' : 'Request deletion'}
              </button>
            )}
          </div>
        </div>

        {/* Inline delete request form */}
        {deleteOpen && deleteStatus !== 'sent' && (
          <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3 space-y-2">
            <p className="text-xs font-medium text-red-800">
              Deletion requires admin approval. A notification will be sent to Sharon / admin for review.
            </p>
            <textarea
              value={deleteReason}
              onChange={e => setDeleteReason(e.target.value)}
              placeholder="Reason for deletion (required)"
              rows={2}
              className="w-full text-xs rounded border border-red-200 bg-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={submitDeleteRequest}
                disabled={!deleteReason.trim() || deleteStatus === 'submitting'}
                className="text-xs px-3 py-1 rounded bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition"
              >
                {deleteStatus === 'submitting' ? 'Submitting…' : 'Submit request'}
              </button>
              {deleteStatus === 'error' && (
                <span className="text-xs text-red-600">Failed to submit — please try again.</span>
              )}
            </div>
          </div>
        )}
        {deleteStatus === 'sent' && (
          <div className="mt-2 rounded-lg border border-green-100 bg-green-50 px-4 py-2 text-xs text-green-800">
            Deletion request submitted. Sharon and the admin team have been notified.
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="AICS tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap py-2 px-1 border-b-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'border-pacific-600 text-pacific-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.key === 'claims' && claims.length > 0 ? (
                <span className="ml-1.5 inline-block px-1.5 rounded-full text-[10px] bg-gray-100 text-gray-600">
                  {claims.length}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab body */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {activeTab === 'cover' ? <CoverTab doc={doc} versions={versions} /> : null}
        {activeTab === 'raw-materials' ? <RawMaterialsTab doc={doc} /> : null}
        {activeTab === 'claims' ? (
          <ClaimsTab
            claims={claims}
            canEdit={canEdit}
            aicsDocId={id}
            onPropagate={setModalClaim}
            propagatedClaimIds={propagatedClaimIds}
          />
        ) : null}
        {activeTab === 'regulatory' ? <RegulatoryTab doc={doc} claims={claims} setClaims={setClaims} canEdit={can(user, 'aics.claims:edit')} /> : null}
      </div>

      {doc.aiName ? <PcsCoveragePanel doc={doc} /> : null}

      {!canEdit ? (
        <p className="text-xs text-gray-400 text-right">
          Read-only view — RA, admin, and super-users can edit this AICS doc.
        </p>
      ) : null}

      {modalClaim && (
        <PropagateModal
          aicsDocId={id}
          claim={modalClaim}
          onClose={() => setModalClaim(null)}
          onSuccess={(result) => {
            setPropagatedClaimIds(prev => new Set([...prev, modalClaim.id]));
          }}
        />
      )}
    </div>
  );
}

// ─── PCS Coverage Panel ─────────────────────────────────────────────────────

function PcsCoveragePanel({ doc }) {
  const [coverage, setCoverage] = useState(null);
  const [coverageLoading, setCoverageLoading] = useState(false);

  useEffect(() => {
    if (!doc?.aiName) return;
    setCoverageLoading(true);
    fetch(`/api/pcs/aics-backfill?ingredient=${encodeURIComponent(doc.aiName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setCoverage(data); setCoverageLoading(false); })
      .catch(() => setCoverageLoading(false));
  }, [doc?.aiName]);

  if (coverageLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">PCS Coverage</h2>
        <div className="animate-pulse space-y-2">
          <div className="h-2 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-100 rounded w-1/3" />
        </div>
      </div>
    );
  }

  if (!coverage) return null;

  const { groups = [] } = coverage;

  const counts = {};
  let totalInstances = 0;
  for (const g of groups) {
    counts[g.status] = (counts[g.status] || 0) + 1;
    totalInstances += (g.instances?.length || 1);
  }

  const STATUS_META = [
    { key: 'pending',          label: 'Ready to review', textCls: 'text-pacific-700', bgCls: 'bg-pacific-50',  icon: '●' },
    { key: 'low-confidence',   label: 'Low confidence',  textCls: 'text-amber-700',   bgCls: 'bg-amber-50',    icon: '◑' },
    { key: 'unmatched',        label: 'No AICS match',   textCls: 'text-red-700',     bgCls: 'bg-red-50',      icon: '⚠' },
    { key: 'no-aics',          label: 'Pending AICS',    textCls: 'text-gray-600',    bgCls: 'bg-gray-50',     icon: '·' },
  ];

  const iconFor = (status) => STATUS_META.find(s => s.key === status)?.icon || '·';
  const iconClsFor = (status) => {
    const m = STATUS_META.find(s => s.key === status);
    return m ? m.textCls : 'text-gray-400';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">PCS Coverage</h2>
        {groups.length > 0 && (
          <Link
            href={`/research/pcs/aics-backfill?ingredient=${encodeURIComponent(doc.aiName)}`}
            className="text-xs text-pacific-600 hover:text-pacific-800 font-medium"
          >
            Review unmapped claims →
          </Link>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-green-700 flex items-center gap-1.5">
          <span className="text-green-500 text-base">✓</span>
          All PCS claims for {doc.aiName} have been mapped to AICS claims.
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-3">
            {groups.length} claim group{groups.length !== 1 ? 's' : ''} await review —&nbsp;
            {totalInstances} PCS claim instance{totalInstances !== 1 ? 's' : ''} total
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {STATUS_META.filter(m => counts[m.key]).map(({ key, label, textCls, bgCls }) => (
              <div key={key} className={`rounded-lg px-3 py-2 ${bgCls}`}>
                <div className={`text-xl font-bold ${textCls}`}>{counts[key]}</div>
                <div className={`text-xs ${textCls} opacity-80`}>{label}</div>
              </div>
            ))}
          </div>

          <div className="divide-y divide-gray-50">
            {groups.slice(0, 8).map((g) => (
              <div key={g.key} className="flex items-start gap-2 text-xs py-1.5">
                <span className={`mt-0.5 shrink-0 font-mono ${iconClsFor(g.status)}`}>{iconFor(g.status)}</span>
                <span className="text-gray-700 flex-1 min-w-0 truncate">{g.claimText}</span>
                <span className="text-gray-400 shrink-0 whitespace-nowrap">
                  {g.instances?.length || 1}×
                </span>
              </div>
            ))}
            {groups.length > 8 && (
              <p className="text-xs text-gray-400 text-center pt-2">+{groups.length - 8} more</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────

function CoverTab({ doc, versions = [] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Document Revision History</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <th className="text-left py-2 pr-4">Version</th>
              <th className="text-left py-2 pr-4">Effective Date</th>
              <th className="text-left py-2 pr-4">Change Description</th>
              <th className="text-left py-2 pr-4">Dept</th>
              <th className="text-left py-2 pr-4">Individual</th>
            </tr>
          </thead>
          <tbody>
            {versions.length > 0 ? versions.map((v) => (
              <tr key={v.id || v.version} className="border-b border-gray-100">
                <td className="py-2 pr-4 font-mono text-xs">
                  {v.version}
                  {v.isLatest ? (
                    <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded-full text-[9px] bg-green-100 text-green-700 font-medium">
                      latest
                    </span>
                  ) : null}
                </td>
                <td className="py-2 pr-4 text-gray-600">{v.effectiveDate || '—'}</td>
                <td className="py-2 pr-4">{v.changeDescription || '—'}</td>
                <td className="py-2 pr-4 text-xs">{v.responsibleDept || '—'}</td>
                <td className="py-2 pr-4 text-xs">{v.responsibleIndividual || '—'}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" className="py-6 text-center text-sm text-gray-400">
                  No versions yet — add the first version to track revision history.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {doc.documentNotes ? (
        <div className="border-t border-gray-100 pt-3">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Notes</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{doc.documentNotes}</p>
        </div>
      ) : null}
    </div>
  );
}

function RawMaterialsTab() {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
        Table A — Applicable NN Raw Materials
      </h2>
      <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-4">
        <p className="text-sm font-medium text-amber-900 mb-1">Read-only view</p>
        <p className="text-xs text-amber-800">
          Raw materials (FM PLM#, AI Source, AI Form) are maintained in the AICS
          database. In-platform editing is coming in a future release.
        </p>
      </div>
    </div>
  );
}

function ClaimsTab({ claims, canEdit = false, aicsDocId, onPropagate, propagatedClaimIds }) {
  if (!claims || claims.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No claims on this AICS yet.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
          Claims & Minimum Dose by Demographic
        </h2>
        {canEdit && (
          <p className="text-xs text-gray-500">Authorized claims can be pushed to qualifying PCS documents.</p>
        )}
      </div>
      <p className="text-xs text-gray-500">
        Grade encodes substantiation strength (A = strong, B = adequate, C = limited).
      </p>
      <ul className="divide-y divide-gray-200">
        {claims.map((c) => {
          const alreadyDone = propagatedClaimIds?.has(c.id);
          return (
            <li key={c.id} className="py-3">
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                    c.grade === 'A' ? 'bg-green-100 text-green-800'
                      : c.grade === 'B' ? 'bg-blue-100 text-blue-800'
                      : c.grade === 'C' ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {c.grade || '—'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{c.claimText}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    {c.benefitCategory ? <span>{c.benefitCategory}</span> : null}
                    {c.ageGroup ? <span>· {c.ageGroup}</span> : null}
                    {c.sex ? <span>· {c.sex}</span> : null}
                    {c.minDose ? (
                      <span className="font-medium text-gray-700">
                        · Min dose: {c.minDose}{c.minDoseUnit ? ` ${c.minDoseUnit}` : ''}
                        {c.minDoseSecondary ? ` (${c.minDoseSecondary}${c.minDoseSecondaryUnit ? ` ${c.minDoseSecondaryUnit}` : ''})` : ''}
                      </span>
                    ) : null}
                    {c.fdaDsheaDisclaimerRequired ? <span>· Requires FDA/DSHEA disclaimer</span> : null}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  {c.claimStatus ? (
                    <span className={`text-[10px] uppercase tracking-wider font-medium ${
                      c.claimStatus === 'Authorized' ? 'text-green-600'
                        : c.claimStatus === 'Pending' ? 'text-amber-600'
                        : c.claimStatus === 'Rejected' ? 'text-red-500'
                        : 'text-gray-400'
                    }`}>{c.claimStatus}</span>
                  ) : null}
                  {canEdit && c.claimStatus === 'Authorized' && (
                    alreadyDone ? (
                      <span className="text-xs text-green-600 font-medium">Propagated ✓</span>
                    ) : (
                      <button
                        onClick={() => onPropagate && onPropagate(c)}
                        className="text-xs px-2.5 py-1 rounded-md bg-pacific-50 text-pacific-700 hover:bg-pacific-100 border border-pacific-200 font-medium whitespace-nowrap"
                      >
                        Propagate →
                      </button>
                    )
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RegulatoryTab({ doc, claims, setClaims, canEdit = false }) {
  const cls = Array.isArray(claims) ? claims : [];
  const disclaimerCount = cls.filter((c) => c.fdaDsheaDisclaimerRequired).length;
  const grades = cls.reduce((acc, c) => { acc[c.grade || '—'] = (acc[c.grade || '—'] || 0) + 1; return acc; }, {});
  const cClaims = cls.filter((c) => (c.grade || '').toUpperCase() === 'C' || !c.grade);
  const [editingId, setEditingId] = useState(null);

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Regulatory Review</h2>

      {/* Compliance summary card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">FDA / DSHEA disclaimer</div>
          <div className="text-2xl font-bold text-pacific">{disclaimerCount}</div>
          <div className="text-xs text-gray-500 mt-1">claims require disclaimer on finished product labels</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Substantiation grade mix</div>
          <div className="flex items-baseline gap-2 mt-1">
            {['A', 'B', 'C', '—'].map((g) => grades[g] ? (
              <span key={g} className={`inline-flex items-center gap-1 text-xs ${
                g === 'A' ? 'text-green-700' : g === 'B' ? 'text-blue-700' : g === 'C' ? 'text-yellow-700' : 'text-gray-500'
              }`}>
                <span className="font-bold">{g}</span><span>×{grades[g]}</span>
              </span>
            ) : null)}
          </div>
          <div className="text-xs text-gray-500 mt-2">total claims: {cls.length}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Ingredient safety</div>
          <div className="text-sm text-gray-700">
            Tolerable Upper Intake Level pending — see <Link href="/research/pcs/data/ingredients" className="text-pacific-600 hover:underline">Ingredients DB</Link> for current safety limits.
          </div>
        </div>
      </div>

      {/* Per-claim substantiation table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Per-Claim Substantiation</h3>
          {canEdit ? <span className="text-[10px] text-gray-500">Click <span className="font-mono bg-gray-100 px-1 rounded">Edit</span> on a row to add refs / monographs / safety limit</span> : null}
        </div>
        {cls.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No claims on this AICS yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <th className="text-left py-2 pr-4">Claim</th>
                  <th className="text-left py-2 pr-4">Grade</th>
                  <th className="text-left py-2 pr-4">Substantiating refs</th>
                  <th className="text-left py-2 pr-4">Monographs</th>
                  <th className="text-left py-2 pr-4">Safety limit</th>
                  {canEdit ? <th className="text-right py-2 pr-2 w-16"></th> : null}
                </tr>
              </thead>
              <tbody>
                {cls.map((c) => (
                  <RegulatoryRow
                    key={c.id}
                    claim={c}
                    canEdit={canEdit}
                    isEditing={editingId === c.id}
                    onEditOpen={() => setEditingId(c.id)}
                    onEditClose={() => setEditingId(null)}
                    onSaved={(updated) => {
                      if (typeof setClaims === 'function') {
                        setClaims((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
                      }
                      setEditingId(null);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Grade-C / ungraded claims spotlight */}
      {cClaims.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold mb-1">Substantiation review needed</p>
          <p className="text-xs">
            {cClaims.length} claim{cClaims.length === 1 ? '' : 's'} carry Grade C or no grade — these warrant RA review before label use.
            Refer to monograph alignment (Health Canada NHP, NIH ODS RDA, etc.) and document any updated grade in Notion.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function RegulatoryRow({ claim: c, canEdit, isEditing, onEditOpen, onEditClose, onSaved }) {
  const [draft, setDraft] = useState({
    substantiatingRefs: c.substantiatingRefs || '',
    regulatoryMonographs: c.regulatoryMonographs || '',
    safetyLimit: c.safetyLimit ?? '',
    safetyLimitUnit: c.safetyLimitUnit || '',
    safetyNotes: c.safetyNotes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/pcs/aics/claims/${c.id}/regulatory`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`);
      onSaved(body);
    } catch (err) {
      setError(`Save failed: ${err?.message || 'unknown'}`);
    } finally {
      setSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <tr className="border-b border-gray-100 align-top">
        <td className="py-2 pr-4 max-w-xs">
          <div className="text-xs text-gray-500">{c.benefitCategory || '—'}</div>
          <div className="text-sm text-gray-800 line-clamp-2">{c.claimText}</div>
        </td>
        <td className="py-2 pr-4">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
            c.grade === 'A' ? 'bg-green-100 text-green-800'
              : c.grade === 'B' ? 'bg-blue-100 text-blue-800'
              : c.grade === 'C' ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-600'
          }`}>{c.grade || '—'}</span>
        </td>
        <td className="py-2 pr-4 text-xs text-gray-700 max-w-sm">
          {c.substantiatingRefs ? <span className="whitespace-pre-wrap">{c.substantiatingRefs}</span> : <span className="text-gray-400 italic">—</span>}
        </td>
        <td className="py-2 pr-4 text-xs text-gray-700 max-w-sm">
          {c.regulatoryMonographs ? <span className="whitespace-pre-wrap">{c.regulatoryMonographs}</span> : <span className="text-gray-400 italic">—</span>}
        </td>
        <td className="py-2 pr-4 text-xs text-gray-700">
          {c.safetyLimit != null ? (
            <span className="font-mono">{c.safetyLimit}{c.safetyLimitUnit ? ` ${c.safetyLimitUnit}` : ''}</span>
          ) : <span className="text-gray-400 italic">—</span>}
        </td>
        {canEdit ? (
          <td className="py-2 pr-2 text-right">
            <button
              type="button"
              onClick={onEditOpen}
              className="text-xs text-pacific-600 hover:text-pacific-700 hover:underline"
            >
              Edit
            </button>
          </td>
        ) : null}
      </tr>
    );
  }

  // Edit mode — full-width row.
  return (
    <tr className="border-b border-gray-100 bg-pacific-50/50 align-top">
      <td colSpan={canEdit ? 6 : 5} className="py-3 px-3">
        <div className="space-y-3">
          <div className="text-xs text-gray-600">
            <span className="font-semibold">Editing:</span> {c.benefitCategory ? `${c.benefitCategory} — ` : ''}{c.claimText}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-medium text-gray-600 uppercase tracking-wider">Substantiating refs</span>
              <textarea
                value={draft.substantiatingRefs}
                onChange={(e) => setDraft((d) => ({ ...d, substantiatingRefs: e.target.value }))}
                rows={3}
                placeholder="[7] RCT in girls (avg age 11.4)... ; [8] Health Canada Multi-Vit/Mineral Monograph"
                className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded-md font-mono"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-gray-600 uppercase tracking-wider">Regulatory monographs</span>
              <textarea
                value={draft.regulatoryMonographs}
                onChange={(e) => setDraft((d) => ({ ...d, regulatoryMonographs: e.target.value }))}
                rows={3}
                placeholder="https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/ — NIH ODS Vit D Fact Sheet"
                className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-[11px] font-medium text-gray-600 uppercase tracking-wider">Safety limit</span>
              <input
                type="number"
                value={draft.safetyLimit}
                onChange={(e) => setDraft((d) => ({ ...d, safetyLimit: e.target.value }))}
                placeholder="e.g. 4000"
                className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded-md font-mono"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-gray-600 uppercase tracking-wider">Unit</span>
              <select
                value={draft.safetyLimitUnit}
                onChange={(e) => setDraft((d) => ({ ...d, safetyLimitUnit: e.target.value }))}
                className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded-md bg-white"
              >
                <option value="">—</option>
                <option value="mcg">mcg</option>
                <option value="mg">mg</option>
                <option value="IU">IU</option>
                <option value="g">g</option>
                <option value="% DV">% DV</option>
              </select>
            </label>
            <label className="block md:col-span-1">
              <span className="text-[11px] font-medium text-gray-600 uppercase tracking-wider">Safety notes</span>
              <input
                type="text"
                value={draft.safetyNotes}
                onChange={(e) => setDraft((d) => ({ ...d, safetyNotes: e.target.value }))}
                placeholder="e.g. Watch interactions with Ca/P"
                className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
              />
            </label>
          </div>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">{error}</div>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onEditClose}
              disabled={saving}
              className="text-xs px-3 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="text-xs px-3 py-1 rounded-md bg-pacific-600 text-white hover:bg-pacific-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}
