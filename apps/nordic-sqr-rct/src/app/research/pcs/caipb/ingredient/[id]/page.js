'use client';

/**
 * CAIPB — Per-Ingredient Dashboard
 * Route: /research/pcs/caipb/ingredient/[id]
 *
 * Modelled on the "Magnesium dashboard" spec from §4.6:
 *   - # of products stat
 *   - Forms & Their Sources table (AI Form → AI Source → FM PLM#)
 *   - Benefit Categories Supported panel
 *   - Form Usage (%) chart
 *   - Form(s) Used by Each Product table (Product → AI Form → FM PLM# → PCS doc)
 *   - Cross-links to benefit and product dashboards
 *
 * Super-user-only (Budget C preview).
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import RoleRoute from '@/components/RoleRoute';
import { CLAIM_AUTHORITY_REGIONS } from '@/lib/pcs-config';

const STATUS_COLORS = {
  'Supported':   'bg-green-100 text-green-800',
  'Thin':        'bg-yellow-100 text-yellow-800',
  'Unsupported': 'bg-red-100 text-red-700',
};

function AuthorityChip({ region }) {
  return (
    <span className="inline-block text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5">
      {region}
    </span>
  );
}

function FormUsageBar({ form, count, pct }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-32 text-xs text-gray-600 truncate" title={form}>{form}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="bg-pacific-500 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 w-16 text-right">{pct}% ({count})</div>
    </div>
  );
}

function IngredientDashboardContent() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [region, setRegion] = useState('');

  const load = useCallback((reg) => {
    setLoading(true);
    const url = `/api/pcs/caipb/ingredient/${id}${reg ? `?region=${encodeURIComponent(reg)}` : ''}`;
    fetch(url)
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e.error)))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [id]);

  useEffect(() => { load(region); }, [load, region]);

  if (loading && !data) {
    return <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading…</div>;
  }
  if (error) {
    return <div className="p-6 text-red-600 text-sm">{error}</div>;
  }
  if (!data) return null;

  const { ingredient, products, formUsage, benefitCategories, claims, totalClaimCount } = data;

  // Unique forms+sources from products list
  const formSourceRows = [];
  const seenFormSource = new Set();
  for (const p of products) {
    const key = `${p.aiForm || ''}|${p.ingredientSource || ''}|${p.fmPlm || ''}`;
    if (!seenFormSource.has(key)) {
      seenFormSource.add(key);
      formSourceRows.push({ form: p.aiForm, source: p.ingredientSource, fmPlm: p.fmPlm });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
          <Link href="/research/pcs" className="hover:text-gray-600">Command Center</Link>
          <span>/</span>
          <Link href="/research/pcs/caipb" className="hover:text-gray-600">CAIPB</Link>
          <span>/</span>
          <span className="text-gray-600 font-medium">Ingredient</span>
        </div>

        {/* Header + region filter */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{ingredient.canonicalName}</h1>
            <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
              {ingredient.category && <span>{ingredient.category}</span>}
              {ingredient.standardUnit && <span>Standard unit: {ingredient.standardUnit}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Region</label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-pacific-400"
            >
              <option value="">All regions</option>
              {CLAIM_AUTHORITY_REGIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {region && (
              <button onClick={() => setRegion('')} className="text-xs text-gray-400 hover:text-gray-600 underline">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{products.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Products containing this ingredient</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{formUsage.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Distinct forms used</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{totalClaimCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {region ? `Claims (${region})` : 'Total claims'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Forms & Sources table */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Forms &amp; Their Sources</h2>
            {formSourceRows.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No formula lines on file</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="pb-1 font-medium">AI Form</th>
                    <th className="pb-1 font-medium">Source</th>
                    <th className="pb-1 font-medium">FM PLM#</th>
                  </tr>
                </thead>
                <tbody>
                  {formSourceRows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="py-1.5 pr-2 text-gray-700">{row.form || <span className="text-gray-300 italic">—</span>}</td>
                      <td className="py-1.5 pr-2 text-gray-600">{row.source || <span className="text-gray-300 italic">—</span>}</td>
                      <td className="py-1.5 text-gray-600 font-mono">{row.fmPlm || <span className="text-gray-300 italic">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Benefit categories */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Benefit Categories Supported</h2>
            {benefitCategories.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No mapped claims</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {benefitCategories.map(bc => (
                  <div key={bc.id} className="flex items-center justify-between">
                    <Link
                      href={`/research/pcs/caipb/benefit/${bc.id}`}
                      className="text-xs text-pacific-600 hover:underline"
                    >
                      {bc.name}
                    </Link>
                    <span className="text-xs text-gray-400">{bc.claimCount} claim{bc.claimCount !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Form Usage chart */}
        {formUsage.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Form Usage Across Products (%)</h2>
            <div className="space-y-1">
              {formUsage.map((f, i) => (
                <FormUsageBar key={i} form={f.form} count={f.count} pct={f.pct} />
              ))}
            </div>
          </div>
        )}

        {/* Products table */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Form(s) Used by Each Product</h2>
          {products.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No products found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="pb-1.5 pr-4 font-medium">Product</th>
                    <th className="pb-1.5 pr-4 font-medium">AI Form</th>
                    <th className="pb-1.5 pr-4 font-medium">FM PLM#</th>
                    <th className="pb-1.5 pr-4 font-medium">Dose</th>
                    <th className="pb-1.5 font-medium">PCS Doc</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="py-1.5 pr-4">
                        {p.pcsDocumentId ? (
                          <Link href={`/research/pcs/caipb/product/${p.pcsDocumentId}`} className="text-pacific-600 hover:underline">
                            {p.finishedGoodName || p.pcsId || '—'}
                          </Link>
                        ) : (
                          <span className="text-gray-600">{p.finishedGoodName || p.pcsId || '—'}</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-4 text-gray-600">{p.aiForm || <span className="text-gray-300 italic">—</span>}</td>
                      <td className="py-1.5 pr-4 text-gray-600 font-mono">{p.fmPlm || <span className="text-gray-300 italic">—</span>}</td>
                      <td className="py-1.5 pr-4 text-gray-600">
                        {p.amountPerServing != null ? `${p.amountPerServing}${p.amountUnit ? ` ${p.amountUnit}` : ''}` : <span className="text-gray-300 italic">—</span>}
                      </td>
                      <td className="py-1.5">
                        {p.pcsDocumentId ? (
                          <Link href={`/research/pcs/documents/${p.pcsDocumentId}`} className="text-gray-400 hover:text-pacific-600 text-xs">
                            {p.pcsId || 'View'}
                          </Link>
                        ) : (
                          <span className="text-gray-300 italic">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Claims (region-aware) */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">
            Claims
            {region && <span className="ml-2 text-xs font-normal text-blue-600">filtered: {region}</span>}
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            {claims.length} of {totalClaimCount} total
          </p>
          {claims.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No claims match this filter</p>
          ) : (
            <div className="space-y-2">
              {claims.map(row => (
                <div key={row.claimId} className="border-b border-gray-50 pb-2 last:border-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-xs text-gray-700 leading-relaxed">{row.claimText}</p>
                    {row.status && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[row.status] || 'bg-gray-100 text-gray-600'}`}>
                        {row.status}
                      </span>
                    )}
                  </div>
                  {row.authorityRegions && row.authorityRegions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {row.authorityRegions.map(r => <AuthorityChip key={r} region={r} />)}
                    </div>
                  )}
                  {row.benefitCategory && (
                    <Link href={`/research/pcs/caipb/benefit/${row.benefitCategory.id}`} className="text-xs text-gray-400 hover:text-pacific-600 mt-0.5 inline-block">
                      {row.benefitCategory.name}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function IngredientDashboard() {
  return (
    <RoleRoute requires={['super-user']}>
      <IngredientDashboardContent />
    </RoleRoute>
  );
}
