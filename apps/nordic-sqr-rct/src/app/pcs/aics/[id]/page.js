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

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { can } from '@/lib/auth/capabilities';

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
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(null);
  const [activeTab, setActiveTab] = useState('cover');

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
        if (!r.ok) return [];
        return r.json();
      }),
    ])
      .then(([d, c]) => {
        setDoc(d);
        setClaims(Array.isArray(c) ? c : []);
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
          <Link href="/pcs/aics" className="hover:text-pacific">PCS · AICS</Link>
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
        AICS document not found. <Link href="/pcs/aics" className="text-pacific-600 hover:underline">Back to library</Link>
      </div>
    );
  }

  const canEdit = can(user, 'aics.documents:edit');

  return (
    <div className="space-y-5">
      {/* Breadcrumb + header */}
      <div>
        <div className="text-xs text-gray-500 mb-1">
          <Link href="/pcs/aics" className="hover:text-pacific">PCS · AICS</Link>
          <span className="mx-1">/</span>
          <span className="text-gray-700">{doc.aicsId || id}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">
            {doc.aicsId || 'AICS'}
            {doc.aiNameText ? <span className="text-gray-600 font-normal ml-2">— {doc.aiNameText}</span> : null}
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
          </div>
        </div>
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
        {activeTab === 'cover' ? <CoverTab doc={doc} /> : null}
        {activeTab === 'raw-materials' ? <RawMaterialsTab doc={doc} /> : null}
        {activeTab === 'claims' ? <ClaimsTab claims={claims} /> : null}
        {activeTab === 'regulatory' ? <RegulatoryTab doc={doc} claims={claims} setClaims={setClaims} canEdit={can(user, 'aics.claims:edit')} /> : null}
      </div>

      {!canEdit ? (
        <p className="text-xs text-gray-400 text-right">
          Read-only view — RA, admin, and super-users can edit this AICS doc.
        </p>
      ) : null}
    </div>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────

function CoverTab({ doc }) {
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
            {Array.isArray(doc.versions) && doc.versions.length > 0 ? doc.versions.map((v) => (
              <tr key={v.id || v.version} className="border-b border-gray-100">
                <td className="py-2 pr-4 font-mono text-xs">{v.version}</td>
                <td className="py-2 pr-4 text-gray-600">{v.effectiveDate || '—'}</td>
                <td className="py-2 pr-4">{v.changeDescription || '—'}</td>
                <td className="py-2 pr-4 text-xs">{v.responsibleDept || '—'}</td>
                <td className="py-2 pr-4 text-xs">{v.responsibleIndividual || '—'}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" className="py-6 text-center text-sm text-gray-400">
                  No version history loaded yet.
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

function RawMaterialsTab({ doc }) {
  const rows = Array.isArray(doc.rawMaterials) ? doc.rawMaterials : [];
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
        Table A — Applicable NN Raw Materials
      </h2>
      <p className="text-xs text-gray-500">
        Per-AICS roster of qualified raw materials. PLM# is volatile and may be deprecated; SAP material number is the stable reference.
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <th className="text-left py-2 pr-4">FM PLM #</th>
              <th className="text-left py-2 pr-4">AI Source</th>
              <th className="text-left py-2 pr-4">AI Form</th>
              <th className="text-left py-2 pr-4">Active Ingredient</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((r) => (
              <tr key={r.id || r.fmPlmNumber} className="border-b border-gray-100">
                <td className="py-2 pr-4 font-mono text-xs">{r.fmPlmNumber || '—'}</td>
                <td className="py-2 pr-4">{r.aiSourceText || '—'}</td>
                <td className="py-2 pr-4">{r.aiFormText || '—'}</td>
                <td className="py-2 pr-4">{r.aiNameText || '—'}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" className="py-6 text-center text-sm text-gray-400">
                  No raw materials linked yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClaimsTab({ claims }) {
  if (!claims || claims.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No claims on this AICS yet.</p>;
  }
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
        Claims & Minimum Dose by Demographic
      </h2>
      <p className="text-xs text-gray-500">
        Each row is one claim × demographic pairing. Grade encodes substantiation strength (A = strong, B = adequate, C = limited).
      </p>
      <ul className="divide-y divide-gray-200">
        {claims.map((c) => (
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
                  {c.ageGroupCode ? <span>· {c.ageGroupCode}</span> : null}
                  {c.sexCode ? <span>· {c.sexCode}</span> : null}
                  {c.minDose ? (
                    <span className="font-medium text-gray-700">
                      · Min dose: {c.minDose}{c.minDoseUnit ? ` ${c.minDoseUnit}` : ''}
                      {c.minDoseSecondary ? ` (${c.minDoseSecondary}${c.minDoseSecondaryUnit ? ` ${c.minDoseSecondaryUnit}` : ''})` : ''}
                    </span>
                  ) : null}
                  {c.fdaDsheaDisclaimerRequired ? <span>· Requires FDA/DSHEA disclaimer</span> : null}
                </div>
              </div>
              {c.claimStatus ? (
                <div className="shrink-0">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500">{c.claimStatus}</span>
                </div>
              ) : null}
            </div>
          </li>
        ))}
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
            Tolerable Upper Intake Level pending — see <Link href="/pcs/data/ingredients" className="text-pacific-600 hover:underline">Ingredients DB</Link> for current safety limits.
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
