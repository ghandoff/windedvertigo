'use client';

/**
 * CAIPB — Per-Benefit-Category Dashboard
 * Route: /research/pcs/caipb/benefit/[id]
 *
 * Packages C + A + B:
 *   C — Claim Status Donut
 *   A — Evidence Quality Bars per ingredient (horizontal BarChart)
 *   B — Regional Compliance Grid
 *
 * Super-user-only (Budget C preview).
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
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

// ─── Package A — Evidence Quality Bars ───────────────────────────────────────

function EvidenceQualityBars({ claims, ingredients }) {
  // Group claims by ingredient.id, compute mean evidence score per ingredient
  const ingScores = {};
  for (const c of claims) {
    if (!c.ingredient) continue;
    const k = c.ingredient.id;
    if (!ingScores[k]) ingScores[k] = { id: k, name: c.ingredient.name, scores: [], claimCount: 0 };
    ingScores[k].claimCount++;
    if (c.statusInputs?.meanScore !== null && c.statusInputs?.meanScore !== undefined) {
      ingScores[k].scores.push(c.statusInputs.meanScore);
    }
  }

  const barData = Object.values(ingScores).map(({ id, name, scores, claimCount }) => ({
    id,
    name: name.length > 22 ? name.slice(0, 21) + '…' : name,
    score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) : 0,
    claimCount,
  })).sort((a, b) => b.score - a.score);

  if (barData.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic">No ingredients with evidence scores</p>
    );
  }

  const chartHeight = Math.max(120, barData.length * 36 + 40);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 10 }}
          tickFormatter={v => `${v}%`}
        />
        <YAxis
          dataKey="name"
          type="category"
          tick={{ fontSize: 10 }}
          width={95}
        />
        <Tooltip
          formatter={(val, _, { payload }) => [
            `${val}% avg quality · ${payload.claimCount} claim${payload.claimCount !== 1 ? 's' : ''}`,
          ]}
        />
        <Bar dataKey="score" fill={CHART_COLORS.pacific} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Package B — Regional Compliance Grid ────────────────────────────────────

function RegionalComplianceGrid({ claims, ingredients }) {
  const noRegionData = claims.every(c => !c.authorityRegions?.length);

  if (noRegionData) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-700">
        Authority regions not yet assessed — use the Claims editor to assign FDA / EFSA / Health Canada / etc. applicability.
      </div>
    );
  }

  const hasApproval = (region, ingId) =>
    claims.some(c => c.ingredient?.id === ingId && (c.authorityRegions || []).includes(region));

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left pr-4 pb-2 font-medium text-gray-400 w-16">Authority</th>
            {ingredients.map(ing => (
              <th key={ing.id} className="pb-2 px-2 font-medium text-gray-500 text-center">
                <span className="block truncate max-w-20 mx-auto" title={ing.name}>
                  {ing.name.length > 11 ? ing.name.slice(0, 10) + '…' : ing.name}
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
              {ingredients.map(ing => {
                const approved = hasApproval(region, ing.id);
                return (
                  <td key={ing.id} className={`py-1.5 px-2 text-center ${approved ? 'bg-green-50' : ''}`}>
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

// ─── Main content ─────────────────────────────────────────────────────────────

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

  const { benefitCategory, claims, ingredients, products = [], totalClaimCount } = data;

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

        {/* Package C — Stat row with Claim Status Donut */}
        <div className="grid grid-cols-6 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{ingredients.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Ingredients</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{products.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Products</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{totalClaimCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total claims</div>
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

        {/* Package A — Evidence Quality Bars */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Evidence Quality by Ingredient
          </h2>
          <EvidenceQualityBars claims={claims} ingredients={ingredients} />
        </div>

        {/* Package B — Regional Compliance Grid */}
        {ingredients.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Regional Compliance Overview</h2>
            <RegionalComplianceGrid claims={claims} ingredients={ingredients} />
          </div>
        )}

        {/* Products supporting this benefit */}
        {products.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Products Supporting This Benefit</h2>
            <div className="flex flex-wrap gap-2">
              {products.map((p, i) => {
                const label = p.name || p.pcsId || 'Unnamed product';
                const chip = (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50">
                    {label}
                    <span className="text-gray-400">· {p.claimCount}</span>
                  </span>
                );
                return p.id ? (
                  <Link key={p.id} href={`/research/pcs/caipb/product/${p.id}`} className="hover:opacity-80">
                    {chip}
                  </Link>
                ) : (
                  <span key={`v${i}`} title="Product document not resolved">{chip}</span>
                );
              })}
            </div>
          </div>
        )}

        {/* Claims list */}
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
