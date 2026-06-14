'use client';

/**
 * CAIPB — Per-Ingredient Dashboard
 * Route: /research/pcs/caipb/ingredient/[id]
 *
 * Packages C + A + B:
 *   C — Claim Status Donut, Form Usage Pie
 *   A — Human Effect Matrix (evidence by benefit), Dose Range bars on claims
 *   B — Regulatory Readiness Card, Regional Compliance Grid
 *
 * Super-user-only (Budget C preview).
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
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

const FORM_COLORS = [
  '#0077B6', '#48CAE4', '#0D9488', '#7C3AED',
  '#EA580C', '#2563EB', '#16A34A', '#CA8A04',
];

const STATUS_COLORS = {
  Supported:   'bg-green-100 text-green-800',
  Thin:        'bg-yellow-100 text-yellow-800',
  Unsupported: 'bg-red-100 text-red-700',
};

const SHORT_REGIONS = {
  'FDA': 'FDA', 'EFSA': 'EFSA', 'Health Canada': 'CA',
  'TGA': 'TGA', 'FSANZ': 'FSANZ', 'Japan MHLW': 'JP',
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

// ─── Package C — Form Usage Pie ───────────────────────────────────────────────

function FormUsagePie({ formUsage }) {
  if (!formUsage || formUsage.length === 0) return null;
  const data = formUsage.map(f => ({ name: f.form, value: f.count, pct: f.pct }));
  return (
    <div>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value">
            {data.map((_, i) => (
              <Cell key={i} fill={FORM_COLORS[i % FORM_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(val, name, { payload }) => [`${payload.pct}% (${val})`, name]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 justify-center">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: FORM_COLORS[i % FORM_COLORS.length] }} />
            <span className="text-xs text-gray-500">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Package A — Human Effect Matrix ─────────────────────────────────────────

function HumanEffectMatrix({ claims }) {
  const byBenefit = new Map();
  for (const c of claims) {
    if (!c.benefitCategory) continue;
    const bcId = c.benefitCategory.id;
    if (!byBenefit.has(bcId)) byBenefit.set(bcId, { id: bcId, name: c.benefitCategory.name, claims: [] });
    byBenefit.get(bcId).claims.push(c);
  }

  const rows = [...byBenefit.values()].map(({ id, name, claims: bcClaims }) => {
    const supported = bcClaims.filter(c => c.status === 'Supported').length;
    const total = bcClaims.length;
    const scores = bcClaims.map(c => c.statusInputs?.meanScore).filter(s => s !== null && s !== undefined);
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const supportedPct = total ? supported / total : 0;

    let grade, gradeBg, borderColor;
    if (supportedPct >= 0.7 && avgScore >= 0.7) {
      grade = 'A'; gradeBg = 'bg-green-100 text-green-800'; borderColor = '#16A34A';
    } else if (supportedPct >= 0.5) {
      grade = 'B'; gradeBg = 'bg-blue-100 text-blue-800'; borderColor = '#2563EB';
    } else if (supported > 0) {
      grade = 'C'; gradeBg = 'bg-yellow-100 text-yellow-800'; borderColor = '#CA8A04';
    } else {
      grade = 'D'; gradeBg = 'bg-red-100 text-red-700'; borderColor = '#DC2626';
    }

    return { id, name, supported, total, avgScore, grade, gradeBg, borderColor };
  }).sort((a, b) => b.supported - a.supported);

  if (rows.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic">
        No claims linked to canonical claims yet — run backfill-review to populate.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-100">
            <th className="pb-2 pr-4 font-medium">Benefit Area</th>
            <th className="pb-2 pr-3 font-medium text-center">Grade</th>
            <th className="pb-2 pr-3 font-medium text-center">Claims</th>
            <th className="pb-2 pr-3 font-medium text-center">Supported</th>
            <th className="pb-2 font-medium">Evidence Quality</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.id}
              className="border-b border-gray-50 last:border-0"
              style={{ borderLeft: `4px solid ${row.borderColor}` }}
            >
              <td className="py-2 pr-4 pl-2">
                <Link href={`/research/pcs/caipb/benefit/${row.id}`} className="text-pacific-600 hover:underline">
                  {row.name}
                </Link>
              </td>
              <td className="py-2 pr-3 text-center">
                <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${row.gradeBg}`}>
                  {row.grade}
                </span>
              </td>
              <td className="py-2 pr-3 text-center text-gray-600">{row.total}</td>
              <td className="py-2 pr-3 text-center text-gray-600">{row.supported}</td>
              <td className="py-2">
                <div className="flex items-center gap-2">
                  <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden w-20">
                    <div
                      className="absolute inset-y-0 left-0 bg-pacific-500 rounded-full"
                      style={{ width: `${Math.round(row.avgScore * 100)}%` }}
                    />
                  </div>
                  <span className="text-gray-400">{Math.round(row.avgScore * 100)}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Package B — Regional Compliance Grid ────────────────────────────────────

function RegionalComplianceGrid({ claims, cols }) {
  const noRegionData = claims.every(c => !c.authorityRegions?.length);

  if (noRegionData) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-700">
        Authority regions not yet assessed — use the Claims editor to assign FDA / EFSA / Health Canada / etc. applicability.
      </div>
    );
  }

  const hasApproval = (region, colId) =>
    claims.some(c => c.benefitCategory?.id === colId && (c.authorityRegions || []).includes(region));

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left pr-4 pb-2 font-medium text-gray-400 w-16">Authority</th>
            {cols.map(col => (
              <th key={col.id} className="pb-2 px-2 font-medium text-gray-500 text-center">
                <span className="block truncate max-w-20 mx-auto" title={col.name}>
                  {col.name.length > 11 ? col.name.slice(0, 10) + '…' : col.name}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CLAIM_AUTHORITY_REGIONS.map(region => (
            <tr key={region} className="border-t border-gray-100">
              <td className="py-1.5 pr-4 text-gray-600 font-medium whitespace-nowrap">
                {SHORT_REGIONS[region] || region}
              </td>
              {cols.map(col => {
                const approved = hasApproval(region, col.id);
                return (
                  <td key={col.id} className={`py-1.5 px-2 text-center ${approved ? 'bg-green-50' : ''}`}>
                    {approved
                      ? <span className="text-green-600 font-bold">✓</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Package B — Regulatory Readiness Card ───────────────────────────────────

function RegulatoryReadinessCard({ claims, totalClaimCount, productCount }) {
  const supported = claims.filter(c => c.status === 'Supported').length;
  const supportedPct = totalClaimCount ? Math.round(supported / totalClaimCount * 100) : 0;
  const regionsWithClaims = new Set();
  for (const c of claims) for (const r of (c.authorityRegions || [])) regionsWithClaims.add(r);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Executive Summary</h2>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {supportedPct}<span className="text-sm font-normal text-gray-400">%</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Claims Supported</div>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${supportedPct}%` }} />
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {regionsWithClaims.size}<span className="text-sm font-normal text-gray-400">/6</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Regions Assessed</div>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-pacific-500 rounded-full transition-all" style={{ width: `${Math.round(regionsWithClaims.size / 6 * 100)}%` }} />
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{productCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Products Using This</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

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

  // Unique forms+sources from products
  const formSourceRows = [];
  const seenFormSource = new Set();
  for (const p of products) {
    const key = `${p.aiForm || ''}|${p.ingredientSource || ''}|${p.fmPlm || ''}`;
    if (!seenFormSource.has(key)) {
      seenFormSource.add(key);
      formSourceRows.push({ form: p.aiForm, source: p.ingredientSource, fmPlm: p.fmPlm });
    }
  }

  // Dose range scale for Package A
  const maxDoseAll = Math.max(...claims.map(c => c.maxDoseMg || c.minDoseMg || 0), 1);

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

        {/* Package B — Regulatory Readiness Card */}
        <RegulatoryReadinessCard
          claims={claims}
          totalClaimCount={totalClaimCount}
          productCount={products.length}
        />

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

        {/* Package C — Stat row with Claim Status Donut */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{products.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Products</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{formUsage.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Distinct forms</div>
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

        {/* 2-col: Forms table + Package C Form Usage Pie */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Form Usage Across Products</h2>
            {formUsage.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No formula lines on file</p>
            ) : (
              <FormUsagePie formUsage={formUsage} />
            )}
          </div>
        </div>

        {/* Package A — Human Effect Matrix */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Evidence by Benefit Category</h2>
          <HumanEffectMatrix claims={claims} />
        </div>

        {/* Package B — Regional Compliance Grid */}
        {benefitCategories.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Regional Compliance Overview</h2>
            <RegionalComplianceGrid claims={claims} cols={benefitCategories} />
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
                        {p.amountPerServing != null
                          ? `${p.amountPerServing}${p.amountUnit ? ` ${p.amountUnit}` : ''}`
                          : <span className="text-gray-300 italic">—</span>}
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

        {/* Claims with Package A dose range bars */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">
            Claims
            {region && <span className="ml-2 text-xs font-normal text-blue-600">filtered: {region}</span>}
          </h2>
          <p className="text-xs text-gray-400 mb-3">{claims.length} of {totalClaimCount} total</p>
          {claims.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No claims match this filter</p>
          ) : (
            <div className="space-y-3">
              {claims.map(row => {
                const doseMin = row.minDoseMg ?? null;
                const doseMax = row.maxDoseMg ?? doseMin;
                const leftPct = doseMin !== null ? Math.round(doseMin / maxDoseAll * 100) : 0;
                const widthPct = doseMin !== null ? Math.max(2, Math.round((doseMax - doseMin) / maxDoseAll * 100)) : 0;

                return (
                  <div key={row.claimId} className="border-b border-gray-50 pb-3 last:border-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-xs text-gray-700 leading-relaxed">{row.claimText}</p>
                      {row.status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[row.status] || 'bg-gray-100 text-gray-600'}`}>
                          {row.status}
                        </span>
                      )}
                    </div>

                    {/* Package A — Dose range bar */}
                    {doseMin !== null && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-8 text-right">{doseMin}</span>
                        <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden flex-1 max-w-48">
                          <div
                            className="absolute inset-y-0 bg-pacific-400 rounded-full"
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          />
                        </div>
                        {doseMax !== doseMin && <span className="text-xs text-gray-400 w-8">{doseMax}</span>}
                        <span className="text-xs text-gray-400">mg</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {row.authorityRegions && row.authorityRegions.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {row.authorityRegions.map(r => <AuthorityChip key={r} region={r} />)}
                        </div>
                      )}
                      {row.benefitCategory && (
                        <Link href={`/research/pcs/caipb/benefit/${row.benefitCategory.id}`} className="text-xs text-gray-400 hover:text-pacific-600">
                          {row.benefitCategory.name}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
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
