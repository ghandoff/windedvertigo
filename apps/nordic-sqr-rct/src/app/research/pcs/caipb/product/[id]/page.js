'use client';

/**
 * CAIPB — Per-Product Dashboard
 * Route: /research/pcs/caipb/product/[id]
 *
 * Packages C + A + B:
 *   C — Claim Status Donut, Version Timeline
 *   A — Ingredient × Benefit Coverage Matrix
 *   B — Benefit Coverage Radar
 *
 * Super-user-only (Budget C preview).
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';
import RoleRoute from '@/components/RoleRoute';
import { CLAIM_AUTHORITY_REGIONS } from '@/lib/pcs-config';

// ─── Color palette ────────────────────────────────────────────────────────────

const CHART_COLORS = {
  Supported:   '#16A34A',
  Thin:        '#CA8A04',
  Unsupported: '#DC2626',
  pacific:     '#0077B6',
  gray:        '#D1D5DB',
};

const STATUS_COLORS = {
  Supported:   'bg-green-100 text-green-800',
  Thin:        'bg-yellow-100 text-yellow-800',
  Unsupported: 'bg-red-100 text-red-700',
};

// ─── Shared chips ─────────────────────────────────────────────────────────────

function AuthorityChip({ region }) {
  return (
    <span className="inline-block text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5">
      {region}
    </span>
  );
}

// ─── Package C — Claim Status Donut ───────────────────────────────────────────

function ClaimStatusDonut({ claims }) {
  const counts = {};
  for (const c of claims) {
    const k = c.status || 'Unknown';
    counts[k] = (counts[k] || 0) + 1;
  }
  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-20">
        <p className="text-xs text-gray-400 italic">No substantiation data yet</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <PieChart width={96} height={96}>
        <Pie data={data} cx={48} cy={48} innerRadius={28} outerRadius={44} dataKey="value">
          {data.map((entry, i) => (
            <Cell key={i} fill={CHART_COLORS[entry.name] || CHART_COLORS.gray} />
          ))}
        </Pie>
        <Tooltip formatter={(val, name) => [`${val} (${Math.round(val / total * 100)}%)`, name]} />
      </PieChart>
      <div className="flex flex-col gap-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[d.name] || CHART_COLORS.gray }} />
            <span className="text-xs text-gray-600">{d.name}: <span className="font-medium">{d.value}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Package C — Version Timeline ─────────────────────────────────────────────

function VersionTimeline({ versions, latestVersionId }) {
  const sorted = [...versions].sort((a, b) => {
    if (!a.effectiveDate) return 1;
    if (!b.effectiveDate) return -1;
    return a.effectiveDate < b.effectiveDate ? -1 : 1;
  });

  if (sorted.length === 0) return null;

  if (sorted.length === 1) {
    const v = sorted[0];
    return (
      <div className="flex items-center gap-3 py-3">
        <div className="w-3 h-3 rounded-full bg-pacific-600 shrink-0" />
        <div>
          <div className="text-xs font-medium text-gray-700">{v.versionLabel || 'v1'}</div>
          <div className="text-xs text-gray-400">{v.effectiveDate || 'First version'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-0 overflow-x-auto py-4">
      {sorted.map((v, i) => (
        <div key={v.id} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className="text-xs text-gray-600 mb-2 whitespace-nowrap font-medium">
              {v.versionLabel || `v${i + 1}`}
              {v.id === latestVersionId && (
                <span className="ml-1 text-xs text-green-600 font-normal">(latest)</span>
              )}
            </div>
            <div
              className={`w-3 h-3 rounded-full border-2 ${
                v.id === latestVersionId
                  ? 'bg-pacific-600 border-pacific-600'
                  : 'bg-white border-pacific-400'
              }`}
            />
            <div className="text-xs text-gray-400 mt-2 whitespace-nowrap">
              {v.effectiveDate || '—'}
            </div>
          </div>
          {i < sorted.length - 1 && (
            <div className="w-16 h-0.5 bg-pacific-200 mx-1 mb-2" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Package A — Ingredient × Benefit Coverage Matrix ────────────────────────

function CoverageMatrix({ claims }) {
  const ingredientMap = new Map();
  const benefitMap = new Map();
  for (const c of claims) {
    if (c.ingredient) ingredientMap.set(c.ingredient.id, c.ingredient.name);
    if (c.benefitCategory) benefitMap.set(c.benefitCategory.id, c.benefitCategory.name);
  }

  const ingredients = [...ingredientMap.entries()].map(([id, name]) => ({ id, name }));
  const benefits = [...benefitMap.entries()].map(([id, name]) => ({ id, name }));

  if (ingredients.length === 0 || benefits.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic">
        No cross-linked claims yet — canonical claim links needed for this view.
      </p>
    );
  }

  const cellStatus = (ingId, benId) => {
    const matching = claims.filter(c => c.ingredient?.id === ingId && c.benefitCategory?.id === benId);
    if (!matching.length) return null;
    if (matching.some(c => c.status === 'Supported')) return 'Supported';
    if (matching.some(c => c.status === 'Thin')) return 'Thin';
    return 'Unsupported';
  };

  const cellBg = (status) => {
    if (status === 'Supported') return '#16A34A';
    if (status === 'Thin') return '#CA8A04';
    if (status === 'Unsupported') return '#DC2626';
    return '#E5E7EB';
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left pr-3 pb-2 font-medium text-gray-400 min-w-24">Ingredient</th>
              {benefits.map(b => (
                <th key={b.id} className="px-2 pb-2 text-center align-bottom">
                  <div
                    className="text-xs text-gray-500 font-medium"
                    style={{
                      writingMode: 'vertical-rl',
                      transform: 'rotate(180deg)',
                      height: '60px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      maxHeight: '60px',
                    }}
                    title={b.name}
                  >
                    {b.name.length > 14 ? b.name.slice(0, 13) + '…' : b.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ingredients.map(ing => (
              <tr key={ing.id} className="border-t border-gray-100">
                <td className="py-1.5 pr-3 text-gray-600 text-xs whitespace-nowrap">{ing.name}</td>
                {benefits.map(ben => {
                  const st = cellStatus(ing.id, ben.id);
                  return (
                    <td key={ben.id} className="py-1.5 px-2 text-center">
                      <div
                        className="w-4 h-4 rounded-sm mx-auto"
                        style={{ backgroundColor: cellBg(st) }}
                        title={st
                          ? `${ing.name} × ${ben.name}: ${st}`
                          : `${ing.name} × ${ben.name}: No claims`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4 mt-3">
        {[['Supported', '#16A34A'], ['Thin', '#CA8A04'], ['Unsupported', '#DC2626'], ['No claims', '#E5E7EB']].map(([label, color]) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Package B — Benefit Coverage Radar ──────────────────────────────────────

function BenefitCoverageRadar({ byBenefit }) {
  const radarData = [...byBenefit.values()].map(({ name, claims: bcClaims }) => {
    const supported = bcClaims.filter(c => c.status === 'Supported').length;
    const score = bcClaims.length ? Math.round(supported / bcClaims.length * 100) : 0;
    return {
      benefit: name.length > 14 ? name.slice(0, 13) + '…' : name,
      score,
    };
  });

  if (radarData.length < 3) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-xs text-gray-400 italic">
          Need 3+ benefit categories for radar view
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid />
        <PolarAngleAxis dataKey="benefit" tick={{ fontSize: 9 }} />
        <Radar
          name="% Supported"
          dataKey="score"
          stroke={CHART_COLORS.pacific}
          fill={CHART_COLORS.pacific}
          fillOpacity={0.25}
        />
        <Tooltip formatter={val => [`${val}% supported`]} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

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

  // Group claims by benefit category
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

        {/* Package C — Stat row with Claim Status Donut */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{totalClaimCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total claims</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{formulaLines.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Active ingredients</div>
          </div>
          <div className="col-span-3 bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-medium text-gray-500 mb-2">
              Claim Substantiation
              {region && <span className="ml-2 text-blue-500">({region})</span>}
              <span className="ml-2 text-gray-400 font-normal">— {claims.length} of {totalClaimCount} total</span>
            </div>
            <ClaimStatusDonut claims={claims} />
          </div>
        </div>

        {/* Package B (Radar) + Formula Lines — 2-col layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Active Ingredients table */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
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
                      <th className="pb-1.5 pr-4 font-medium">Amount</th>
                      <th className="pb-1.5 font-medium">FM PLM#</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formulaLines.map((line, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-1.5 pr-4 text-gray-700">{line.ai || <span className="text-gray-300 italic">—</span>}</td>
                        <td className="py-1.5 pr-4 text-gray-600">{line.aiForm || <span className="text-gray-300 italic">—</span>}</td>
                        <td className="py-1.5 pr-4 text-gray-600">
                          {line.amountPerServing != null
                            ? `${line.amountPerServing}${line.amountUnit ? ` ${line.amountUnit}` : ''}`
                            : <span className="text-gray-300 italic">—</span>}
                        </td>
                        <td className="py-1.5 text-gray-600 font-mono">{line.fmPlm || <span className="text-gray-300 italic">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Package B — Benefit Coverage Radar */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Evidence Coverage</h2>
            <p className="text-xs text-gray-400 mb-2">% of claims Supported per benefit area</p>
            <BenefitCoverageRadar byBenefit={byBenefit} />
          </div>
        </div>

        {/* Package A — Ingredient × Benefit Coverage Matrix */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Coverage Matrix</h2>
          <p className="text-xs text-gray-400 mb-3">Ingredient × benefit category — cell color = strongest claim status</p>
          <CoverageMatrix claims={claims} />
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

        {/* Package C — Version Timeline + history table */}
        {versions.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">PCS Version History</h2>
            <VersionTimeline versions={versions} latestVersionId={doc.latestVersionId} />
            <table className="w-full text-xs mt-2 border-t border-gray-100 pt-2">
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
