'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';
import {
  HETEROGENEITY, PUBLICATION_BIAS, FUNDING_BIAS, PRECISION,
  EFFECT_SIZE_CATEGORIES, DOSE_RESPONSE_GRADIENT,
} from '@/lib/pcs-config';

/**
 * NutriGrade body-of-evidence certainty page.
 *
 * Computes a per-claim 0-10 certainty score + rating by aggregating:
 *   • SQR rubric mean across supporting studies
 *   • Applicability mean across (study × claim) pairs
 *   • Four RA inputs (heterogeneity, publication bias, funding bias,
 *     precision)
 *   • Two upgrade factors (effect size, dose-response)
 *
 * The rollup is computed server-side in one place (see
 * /api/pcs/claims/[id]/certainty). The "Save & persist" button
 * writes the computed score + rating back to the PCS Claim row so
 * it shows in Notion views and the Claims list.
 */

const RATING_COLORS = {
  'High':     'bg-green-100  text-green-800',
  'Moderate': 'bg-yellow-100 text-yellow-800',
  'Low':      'bg-orange-100 text-orange-800',
  'Very Low': 'bg-red-100    text-red-800',
  'Pending':  'bg-gray-100   text-gray-600',
};

export default function CertaintyPage({ params }) {
  const { id: claimId } = use(params);
  const { user } = useAuth();
  // Client check is UX hint; server is the source of truth (authenticatePcsWrite).
  const canWrite = hasAnyRole(user, ROLE_SETS.PCS_WRITERS);

  const [rollup, setRollup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null); // dirty copy of RA inputs
  const [dirty, setDirty] = useState(false);
  const [persisted, setPersisted] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/pcs/claims/${claimId}/certainty`);
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load');
      const data = await res.json();
      setRollup(data);
      setForm({
        heterogeneity: data.claim.heterogeneity || '',
        publicationBias: data.claim.publicationBias || '',
        fundingBias: data.claim.fundingBias || '',
        precision: data.claim.precision || '',
        effectSizeCategory: data.claim.effectSizeCategory || '',
        doseResponseGradient: data.claim.doseResponseGradient || '',
      });
      setDirty(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => { refresh(); }, [refresh]);

  function updateInput(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    setDirty(true);
  }

  async function saveInputs() {
    setSaving(true);
    setError('');
    try {
      const payload = {
        heterogeneity: form.heterogeneity || null,
        publicationBias: form.publicationBias || null,
        fundingBias: form.fundingBias || null,
        precision: form.precision || null,
        effectSizeCategory: form.effectSizeCategory || null,
        doseResponseGradient: form.doseResponseGradient || null,
      };
      const res = await fetch(`/api/pcs/claims/${claimId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      // Now recompute + persist the score/rating
      const res2 = await fetch(`/api/pcs/claims/${claimId}/certainty`, { method: 'POST' });
      if (!res2.ok) throw new Error((await res2.json()).error || 'Persist failed');
      const data = await res2.json();
      setRollup(data);
      setDirty(false);
      setPersisted(new Date().toISOString());
      setTimeout(() => setPersisted(null), 4000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-1/3" />
        <div className="h-32 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (error && !rollup) {
    return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>;
  }

  const { claim, derivedInputs, certainty } = rollup;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/pcs/claims" className="hover:underline">Claims</Link>
          <span>/</span>
          <Link href={`/pcs/claims/${claimId}`} className="hover:underline">
            {claim?.claim ? claim.claim.slice(0, 60) : claimId.slice(0, 8)}
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Certainty</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Body-of-Evidence Certainty</h1>
        <p className="text-sm text-gray-600 mt-1 max-w-3xl">
          Aggregates SQR quality, applicability, and four body-of-evidence judgments into a single NutriGrade-style certainty rating for this claim.
          Based on Schwingshackl et al., <em>Adv Nutr</em> 2016;7:994 (DOI 10.3945/an.116.013052).
        </p>
      </div>

      {/* Big rating card */}
      <div className="card p-6 text-center">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Certainty of evidence</p>
        <div className="flex items-center justify-center gap-4">
          <span className={`px-6 py-3 rounded-full text-xl font-bold ${RATING_COLORS[certainty.rating]}`}>
            {certainty.rating}
          </span>
          {certainty.score != null && (
            <span className="text-4xl font-bold text-gray-900">{certainty.score}<span className="text-lg text-gray-500">/10</span></span>
          )}
        </div>
        {certainty.cappedAt != null && (
          <p className="text-xs text-orange-700 mt-3">Single-study cap applied — rating limited to Low because only one study supports this claim.</p>
        )}
        {persisted && (
          <p className="text-xs text-green-700 mt-3">Saved and persisted to Notion at {new Date(persisted).toLocaleTimeString()}.</p>
        )}
      </div>

      {/* Derived inputs (read-only) */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Derived from existing data</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-xs text-gray-500 uppercase">Evidence count</p>
            <p className="text-2xl font-bold">{derivedInputs.evidenceCount}</p>
            <p className="text-xs text-gray-500 mt-1">Unique studies linked</p>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-xs text-gray-500 uppercase">SQR mean</p>
            <p className="text-2xl font-bold">{derivedInputs.sqrMean != null ? derivedInputs.sqrMean.toFixed(1) : '—'}<span className="text-sm text-gray-500">/22</span></p>
            <p className="text-xs text-gray-500 mt-1">
              <Link href="/analytics" className="text-pacific-600 hover:underline">From /analytics</Link>
            </p>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-xs text-gray-500 uppercase">Applicability mean</p>
            <p className="text-2xl font-bold">{derivedInputs.applicabilityMean != null ? derivedInputs.applicabilityMean.toFixed(1) : '—'}<span className="text-sm text-gray-500">/10</span></p>
            <p className="text-xs text-gray-500 mt-1">
              <Link href={`/pcs/claims/${claimId}/applicability`} className="text-pacific-600 hover:underline">
                From applicability ({derivedInputs.applicabilityCount} assessed)
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* RA inputs (editable) */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Body-of-evidence inputs (RA assessment)</h2>
          {dirty && (
            <button
              onClick={saveInputs}
              disabled={saving}
              className="px-4 py-2 bg-pacific-600 text-white text-sm font-medium rounded-md hover:bg-pacific-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save & recompute'}
            </button>
          )}
        </div>

        {!canWrite && (
          <p className="text-xs text-gray-500 mb-3 italic">Read-only — pcs or admin role required to edit inputs.</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <InputField label="Heterogeneity" helpText="Between-study consistency of effect direction and magnitude"
            value={form.heterogeneity} options={HETEROGENEITY}
            onChange={v => updateInput('heterogeneity', v)} disabled={!canWrite} />
          <InputField label="Publication bias" helpText="Evidence of selective publication (funnel-plot asymmetry, missing null results)"
            value={form.publicationBias} options={PUBLICATION_BIAS}
            onChange={v => updateInput('publicationBias', v)} disabled={!canWrite} />
          <InputField label="Funding bias" helpText="Independence of funding sources across supporting studies"
            value={form.fundingBias} options={FUNDING_BIAS}
            onChange={v => updateInput('fundingBias', v)} disabled={!canWrite} />
          <InputField label="Precision" helpText="Narrowness of pooled confidence interval / adequacy of sample size"
            value={form.precision} options={PRECISION}
            onChange={v => updateInput('precision', v)} disabled={!canWrite} />
          <InputField label="Effect size category" helpText="Magnitude of observed effect — Large effects upgrade confidence"
            value={form.effectSizeCategory} options={EFFECT_SIZE_CATEGORIES}
            onChange={v => updateInput('effectSizeCategory', v)} disabled={!canWrite} />
          <InputField label="Dose-response gradient" helpText="Does a dose-response relationship exist across supporting studies?"
            value={form.doseResponseGradient} options={DOSE_RESPONSE_GRADIENT}
            onChange={v => updateInput('doseResponseGradient', v)} disabled={!canWrite} />
        </div>
      </div>

      {/* Score breakdown */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Score breakdown</h2>
        {certainty.breakdown && certainty.breakdown.length > 0 ? (
          <div className="space-y-2">
            {certainty.breakdown.map((b, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{b.label}</p>
                  <p className="text-xs text-gray-500">{b.note}</p>
                </div>
                <div className="text-sm font-mono text-gray-700">
                  +{b.pts}{b.max ? <span className="text-gray-400"> / {b.max}</span> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No breakdown available.</p>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">{error}</div>
      )}
    </div>
  );
}

function InputField({ label, helpText, value, options, onChange, disabled }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700">{label}</label>
      {helpText && <p className="text-xs text-gray-500 mb-1">{helpText}</p>}
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full text-sm px-3 py-2 border border-gray-300 rounded bg-white disabled:bg-gray-50 disabled:text-gray-500"
      >
        <option value="">— Not set —</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}
