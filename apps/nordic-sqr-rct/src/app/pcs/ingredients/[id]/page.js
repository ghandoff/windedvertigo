'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';

/**
 * Active Ingredient detail page.
 *
 * Sections:
 *   - Header (canonical name + category + standard unit)
 *   - Synonyms + notes
 *   - FDA RDI / regulatory ceiling / bioavailability / interaction cautions
 *   - Forms table (chemical/strain expressions of this AI)
 *
 * TODO: rollup counts of Evidence items / Formula Lines / Claim Dose Reqs
 *       linked via the new canonical relations. Skipped this round —
 *       relations start empty and a separate query layer will be added
 *       once the migration script populates them.
 */
export default function IngredientDetailPage({ params }) {
  const { id } = use(params);
  const { user } = useAuth(); // reserved for future inline edits
  void user;

  const [ingredient, setIngredient] = useState(null);
  const [forms, setForms] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ingRes, formRes, catalogRes] = await Promise.all([
        fetch(`/api/pcs/ingredients/${id}`),
        fetch(`/api/pcs/ingredient-forms?ingredientId=${id}`),
        fetch(`/api/pcs/ingredients/${id}/dose-graded-claims`),
      ]);
      if (!ingRes.ok) throw new Error('Could not load ingredient');
      const ing = await ingRes.json();
      setIngredient(ing);
      const fm = formRes.ok ? await formRes.json() : [];
      setForms(Array.isArray(fm) ? fm : []);
      const ct = catalogRes.ok ? await catalogRes.json() : null;
      setCatalog(ct);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-1/3" />
        <div className="h-32 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!ingredient) return null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/pcs/ingredients" className="hover:underline">Ingredients</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{ingredient.canonicalName || 'Untitled'}</span>
      </div>

      {/* 2026-05-05 — Read-only notice. Inline-edit affordances are
           planned (see useAuth import above) but not yet wired. Surface
           the limitation so writers don't hunt for a missing pencil.
           Once inline edits ship, swap this banner for the actual
           Edit affordance. */}
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        This page is read-only for now. To edit ingredient metadata,
        use the import flow at <a href="/pcs/admin/imports" className="font-medium underline hover:text-amber-900">/pcs/admin/imports</a>.
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{ingredient.canonicalName || 'Untitled'}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
          {ingredient.category && (
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {ingredient.category}
            </span>
          )}
          {ingredient.standardUnit && (
            <span className="text-xs text-gray-500">
              Standard unit: <span className="font-medium text-gray-700">{ingredient.standardUnit}</span>
            </span>
          )}
        </div>
      </div>

      {/* Synonyms + general notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-xs uppercase text-gray-500 mb-1">Synonyms</div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {ingredient.synonyms || <span className="text-gray-400">— None recorded —</span>}
          </p>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase text-gray-500 mb-1">Notes</div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {ingredient.notes || <span className="text-gray-400">— None —</span>}
          </p>
        </div>
      </div>

      {/* Regulatory + bioavailability */}
      <div className="card p-4 space-y-4">
        <div className="text-xs uppercase text-gray-500 font-medium">Regulatory & bioavailability</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-500">FDA RDI</div>
            <div className="font-medium text-gray-800">
              {ingredient.fdaRdi != null ? `${ingredient.fdaRdi} ${ingredient.fdaRdiUnit || ''}`.trim() : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Regulatory ceiling</div>
            <div className="font-medium text-gray-800">
              {ingredient.regulatoryCeiling != null ? `${ingredient.regulatoryCeiling} ${ingredient.standardUnit || ''}`.trim() : '—'}
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-gray-500">Bioavailability notes</div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">
              {ingredient.bioavailabilityNotes || <span className="text-gray-400">— None —</span>}
            </p>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-gray-500">Interaction cautions</div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">
              {ingredient.interactionCautions || <span className="text-gray-400">— None —</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Dose-graded claim catalog (Phase 4.6 D.1) */}
      <DoseGradedClaimsSection catalog={catalog} ingredient={ingredient} />

      {/* Forms table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Forms</h2>
            <p className="text-xs text-gray-500">
              Chemical or strain-level expressions of this AI ({forms.length} total)
            </p>
          </div>
        </div>
        {forms.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No forms recorded for this ingredient yet.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Form name</th>
                <th className="px-4 py-2 text-left font-medium">Synonyms</th>
                <th className="px-4 py-2 text-left font-medium">Strain ID</th>
                <th className="px-4 py-2 text-left font-medium">Source</th>
                <th className="px-4 py-2 text-left font-medium">Default</th>
              </tr>
            </thead>
            <tbody>
              {forms.map(f => (
                <tr key={f.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-800">{f.formName || '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{f.synonyms || '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{f.strainIdentifier || '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{f.source || '—'}</td>
                  <td className="px-4 py-2">
                    {f.isDefault ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Default</span>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/**
 * Dose-Graded Claim Catalog — Phase 4.6 Bundle D.1.
 *
 * Per Gina's 2026-04-17 spec: at each dose tier, show what claims are
 * authorized for each demographic. Cumulative-tier rule: at any chosen
 * dose, all claims with min_dose ≤ that dose are authorized.
 *
 * Read-only projection over AICS Claims linked to AICS Documents whose
 * aiName matches this ingredient's canonical name. Phase D.2 will turn
 * this projection into a generator that emits a draft AICS .docx.
 */
function DoseGradedClaimsSection({ catalog, ingredient }) {
  if (!catalog) return null;
  const { aicsDocs = [], byAgeGroup = {}, allDemographics = [], totalClaims = 0 } = catalog;

  if (totalClaims === 0) {
    return (
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Dose-Graded Claim Catalog</h2>
            <p className="text-xs text-gray-500 mt-1">
              Per-demographic claim authorizations by minimum dose, sourced from AICS Documents.
            </p>
          </div>
          <Link href="/pcs/aics?status=Pending+RA+Review" className="text-xs text-pacific-600 hover:underline">
            See AICS queue →
          </Link>
        </div>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium mb-1">No AICS document found for {ingredient?.canonicalName || 'this ingredient'}.</p>
          <p className="text-xs">
            Once an AICS doc is uploaded with claims linked to this active ingredient, the
            cumulative dose-tier catalog will populate here.
            See <code className="bg-amber-100 px-1 py-0.5 rounded">docs/runbooks/aics-onboarding.md</code> for the upload flow.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Dose-Graded Claim Catalog</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalClaims} claim{totalClaims === 1 ? '' : 's'} across {allDemographics.length} demographic
            {allDemographics.length === 1 ? '' : 's'}, drawn from {aicsDocs.length} AICS doc
            {aicsDocs.length === 1 ? '' : 's'}.
            <span className="text-gray-400"> Cumulative-tier: at dose X, all claims with min-dose ≤ X are authorized.</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {aicsDocs.map((d) => (
            <Link
              key={d.id}
              href={`/pcs/aics/${d.id}`}
              className="text-xs px-2 py-1 rounded bg-pacific-50 text-pacific-700 hover:bg-pacific-100"
            >
              {d.aicsId || d.id.slice(0, 8)}{d.version != null ? ` v${d.version}` : ''} →
            </Link>
          ))}
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {allDemographics.map((demo) => (
          <DemographicGroup key={demo} demo={demo} claims={byAgeGroup[demo] || []} ingredient={ingredient} />
        ))}
      </div>
    </div>
  );
}

function DemographicGroup({ demo, claims, ingredient }) {
  if (!claims.length) return null;

  // Find unique dose tiers within this demographic for cumulative rendering
  const tiers = [];
  const seen = new Set();
  for (const c of claims) {
    const key = `${c.minDose ?? 'NA'}-${c.minDoseUnit || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      tiers.push({ dose: c.minDose, unit: c.minDoseUnit, doseSecondary: c.minDoseSecondary, doseSecondaryUnit: c.minDoseSecondaryUnit });
    }
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-800">{demo}</h3>
        <span className="text-xs text-gray-500">{claims.length} claim{claims.length === 1 ? '' : 's'}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-2 py-1 text-left font-medium">Min dose</th>
              <th className="px-2 py-1 text-left font-medium">Grade</th>
              <th className="px-2 py-1 text-left font-medium">Benefit</th>
              <th className="px-2 py-1 text-left font-medium">Claim</th>
              <th className="px-2 py-1 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-2 py-1 font-mono text-gray-700">
                  {c.minDose != null
                    ? `${c.minDose} ${c.minDoseUnit || ''}${c.minDoseSecondary != null ? ` (${c.minDoseSecondary} ${c.minDoseSecondaryUnit || ''})` : ''}`
                    : <span className="text-gray-400">NA</span>}
                </td>
                <td className="px-2 py-1">
                  {c.grade ? (
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      c.grade === 'A' ? 'bg-green-100 text-green-800' :
                      c.grade === 'B' ? 'bg-amber-100 text-amber-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>{c.grade}</span>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-2 py-1 text-gray-600">{c.benefitCategory || '—'}</td>
                <td className="px-2 py-1 text-gray-800 leading-snug max-w-md">
                  {c.prefix ? <span className="italic text-gray-500">{c.prefix} </span> : null}
                  {c.claimText}
                </td>
                <td className="px-2 py-1">
                  {c.claimStatus === 'Authorized' ? (
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-800">{c.claimStatus}</span>
                  ) : (
                    <span className="text-gray-500 text-[10px]">{c.claimStatus || '—'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
