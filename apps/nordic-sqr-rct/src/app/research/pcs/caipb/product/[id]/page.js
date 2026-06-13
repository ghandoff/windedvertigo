'use client';

/**
 * CAIPB — Per-Product Dashboard
 * Route: /research/pcs/caipb/product/[id]
 *
 * Shows the claims a product can make, its active ingredients / forms / doses
 * with FM PLM#, and its PCS document version history.
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

function ProductDashboardContent() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [region, setRegion] = useState('');

  const load = useCallback((reg) => {
    setLoading(true);
    const url = `/api/pcs/caipb/product/${id}${reg ? `?region=${encodeURIComponent(reg)}` : ''}`;
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

  const { document: doc, versions, formulaLines, claims, totalClaimCount } = data;

  // Group claims by benefit category for display
  const byBenefit = new Map();
  for (const row of claims) {
    const key = row.benefitCategory?.id || '__none__';
    const label = row.benefitCategory?.name || 'Uncategorized';
    if (!byBenefit.has(key)) byBenefit.set(key, { id: row.benefitCategory?.id, name: label, claims: [] });
    byBenefit.get(key).claims.push(row);
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
          <span className="text-gray-600 font-medium">Product</span>
        </div>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {doc.finishedGoodName || doc.pcsId}
            </h1>
            <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
              <span>{doc.pcsId}</span>
              {doc.format && <span>{doc.format}</span>}
              {doc.fileStatus && <span>{doc.fileStatus}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
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
            <Link
              href={`/research/pcs/documents/${id}`}
              className="text-xs text-pacific-600 hover:underline border border-pacific-200 px-2 py-1 rounded"
            >
              Open PCS Doc →
            </Link>
          </div>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{totalClaimCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total claims</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{formulaLines.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Active ingredients (latest version)</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{versions.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">PCS versions on file</div>
          </div>
        </div>

        {/* Formula lines (ingredients / forms / doses / FM PLM#) */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Active Ingredients (Latest Version)
          </h2>
          {formulaLines.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No formula lines on file</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="pb-1.5 pr-4 font-medium">AI</th>
                    <th className="pb-1.5 pr-4 font-medium">AI Form</th>
                    <th className="pb-1.5 pr-4 font-medium">FM PLM#</th>
                    <th className="pb-1.5 pr-4 font-medium">Amount</th>
                    <th className="pb-1.5 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {formulaLines.map((line, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="py-1.5 pr-4 text-gray-700">{line.ai || <span className="text-gray-300 italic">—</span>}</td>
                      <td className="py-1.5 pr-4 text-gray-600">{line.aiForm || <span className="text-gray-300 italic">—</span>}</td>
                      <td className="py-1.5 pr-4 text-gray-600 font-mono">{line.fmPlm || <span className="text-gray-300 italic">—</span>}</td>
                      <td className="py-1.5 pr-4 text-gray-600">
                        {line.amountPerServing != null
                          ? `${line.amountPerServing}${line.amountUnit ? ` ${line.amountUnit}` : ''}`
                          : <span className="text-gray-300 italic">—</span>}
                      </td>
                      <td className="py-1.5 text-gray-500">{line.ingredientSource || <span className="text-gray-300 italic">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Claims grouped by benefit category */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">
            Claims This Product Can Make
            {region && <span className="ml-2 text-xs font-normal text-blue-600">filtered: {region}</span>}
          </h2>
          <p className="text-xs text-gray-400 mb-3">{claims.length} of {totalClaimCount} total</p>
          {claims.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No claims match this filter</p>
          ) : (
            <div className="space-y-4">
              {[...byBenefit.values()].map(group => (
                <div key={group.id || '__none__'}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {group.id ? (
                      <Link
                        href={`/research/pcs/caipb/benefit/${group.id}`}
                        className="text-xs font-semibold text-pacific-600 hover:underline"
                      >
                        {group.name}
                      </Link>
                    ) : (
                      <span className="text-xs font-semibold text-gray-400 italic">{group.name}</span>
                    )}
                    <span className="text-xs text-gray-300">({group.claims.length})</span>
                  </div>
                  <div className="space-y-2 pl-2 border-l border-gray-100">
                    {group.claims.map(row => (
                      <div key={row.claimId}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-xs text-gray-700 leading-relaxed">{row.claimText}</p>
                          {row.status && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[row.status] || 'bg-gray-100 text-gray-600'}`}>
                              {row.status}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          {row.ingredient && (
                            <Link
                              href={`/research/pcs/caipb/ingredient/${row.ingredient.id}`}
                              className="text-xs text-gray-500 hover:text-pacific-600"
                            >
                              {row.ingredient.name}
                            </Link>
                          )}
                          {row.dose && <span className="text-xs text-gray-400">{row.dose}</span>}
                          {row.authorityRegions && row.authorityRegions.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {row.authorityRegions.map(r => <AuthorityChip key={r} region={r} />)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PCS version history */}
        {versions.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">PCS Version History</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-1.5 pr-4 font-medium">Version</th>
                  <th className="pb-1.5 font-medium">Effective Date</th>
                </tr>
              </thead>
              <tbody>
                {versions.map(v => (
                  <tr key={v.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-1.5 pr-4 text-gray-700">
                      {v.versionLabel || v.id}
                      {v.id === doc.latestVersionId && (
                        <span className="ml-2 text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">latest</span>
                      )}
                    </td>
                    <td className="py-1.5 text-gray-500">{v.effectiveDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProductDashboard() {
  return (
    <RoleRoute requires={['super-user']}>
      <ProductDashboardContent />
    </RoleRoute>
  );
}
