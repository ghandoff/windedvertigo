'use client';

/**
 * CAIPB — Per-Benefit-Category Dashboard
 * Route: /research/pcs/caipb/benefit/[id]
 *
 * Shows ingredients and products that support this benefit category,
 * with substantiating claims (region-filterable).
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

function BenefitDashboardContent() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [region, setRegion] = useState('');

  const load = useCallback((reg) => {
    setLoading(true);
    const url = `/api/pcs/caipb/benefit/${id}${reg ? `?region=${encodeURIComponent(reg)}` : ''}`;
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

  const { benefitCategory, claims, ingredients, totalClaimCount } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
          <Link href="/research/pcs" className="hover:text-gray-600">Command Center</Link>
          <span>/</span>
          <Link href="/research/pcs/caipb" className="hover:text-gray-600">CAIPB</Link>
          <span>/</span>
          <span className="text-gray-600 font-medium">Benefit Category</span>
        </div>

        {/* Header + filter */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{benefitCategory.name}</h1>
            <p className="text-xs text-gray-400 mt-0.5">Benefit Category</p>
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
            <div className="text-2xl font-bold text-gray-900">{claims.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {region ? `Claims (${region})` : 'Total claims'}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{ingredients.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Ingredients supporting this benefit</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{totalClaimCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total claims (all regions)</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Ingredients panel */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Ingredients Supporting This Benefit
            </h2>
            {ingredients.length === 0 ? (
              <p className="text-xs text-gray-400 italic">None on file</p>
            ) : (
              <div className="space-y-1.5">
                {ingredients.map(ing => (
                  <div key={ing.id} className="flex items-center justify-between">
                    <Link
                      href={`/research/pcs/caipb/ingredient/${ing.id}`}
                      className="text-xs text-pacific-600 hover:underline"
                    >
                      {ing.name}
                    </Link>
                    <span className="text-xs text-gray-400">{ing.claimCount} claim{ing.claimCount !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick link to explore */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-700">Explore This Benefit</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Use the Explorer for full substantiation status and evidence counts filtered by this benefit category.
            </p>
            <Link
              href={`/research/pcs/explore?lens=benefit&id=${id}`}
              className="inline-block text-xs text-white bg-pacific-600 hover:bg-pacific-700 px-3 py-1.5 rounded text-center"
            >
              Open in Explorer →
            </Link>
          </div>
        </div>

        {/* Claims list (region-aware) */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">
            Substantiating Claims
            {region && <span className="ml-2 text-xs font-normal text-blue-600">filtered: {region}</span>}
          </h2>
          <p className="text-xs text-gray-400 mb-3">{claims.length} of {totalClaimCount} total</p>
          {claims.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No claims match this filter</p>
          ) : (
            <div className="space-y-3">
              {claims.map(row => (
                <div key={row.claimId} className="border-b border-gray-50 pb-3 last:border-0">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                    <p className="text-xs text-gray-700 leading-relaxed">{row.claimText}</p>
                    {row.status && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[row.status] || 'bg-gray-100 text-gray-600'}`}>
                        {row.status}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    {row.ingredient && (
                      <Link
                        href={`/research/pcs/caipb/ingredient/${row.ingredient.id}`}
                        className="text-xs text-pacific-600 hover:underline"
                      >
                        {row.ingredient.name}
                      </Link>
                    )}
                    {row.dose && <span className="text-xs text-gray-500">{row.dose}</span>}
                    {row.authorityRegions && row.authorityRegions.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {row.authorityRegions.map(r => <AuthorityChip key={r} region={r} />)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BenefitDashboard() {
  return (
    <RoleRoute requires={['super-user']}>
      <BenefitDashboardContent />
    </RoleRoute>
  );
}
