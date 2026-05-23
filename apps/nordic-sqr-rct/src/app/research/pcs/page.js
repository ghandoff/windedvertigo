'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie,
} from 'recharts';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';

// ─────────────────────────────────────────────
// Colors
// ─────────────────────────────────────────────

const COLORS = {
  pacific: '#0077B6',
  pacificLight: '#48CAE4',
  green: '#16A34A',
  yellow: '#CA8A04',
  red: '#DC2626',
  purple: '#7C3AED',
  blue: '#2563EB',
  orange: '#EA580C',
  teal: '#0D9488',
  gray: '#6B7280',
  lightGray: '#D1D5DB',
};

const STATUS_COLORS = {
  Authorized: COLORS.green,
  Proposed: COLORS.yellow,
  'Not approved': COLORS.red,
  NA: COLORS.lightGray,
  Unknown: COLORS.gray,
};

const BUCKET_COLORS = { '3A': COLORS.green, '3B': COLORS.yellow, '3C': COLORS.red };

const EVIDENCE_TYPE_COLORS = [
  COLORS.pacific, COLORS.green, COLORS.purple, COLORS.orange,
  COLORS.teal, COLORS.blue, COLORS.yellow, COLORS.red, COLORS.gray,
];

// ─────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────

function KpiCard({ label, value, sub, href, accent = 'gray' }) {
  const accents = {
    gray: 'border-l-gray-300',
    blue: 'border-l-blue-500',
    green: 'border-l-green-500',
    yellow: 'border-l-yellow-500',
    red: 'border-l-red-500',
    purple: 'border-l-purple-500',
    pacific: 'border-l-pacific-500',
  };
  const card = (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${accents[accent] || accents.gray} p-4 ${href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function ViewToggle({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            value === opt.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ChartCard({ title, toggle, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {toggle}
      </div>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-gray-900 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-medium">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Chart: PCS Extraction Status (Tier 2)
// Full-width progress card — the $50k deliverable health check
// ─────────────────────────────────────────────

function PcsExtractionStatus({ data }) {
  const { total, extracted, notStarted } = data.docExtractionStatus || { total: 0, extracted: 0, notStarted: 0 };
  const pct = total > 0 ? Math.round((extracted / total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">PCS Extraction Progress</h3>
          <p className="text-xs text-gray-400 mt-0.5">Documents with at least one extracted version</p>
        </div>
        <span className={`text-2xl font-bold ${pct === 100 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-pacific-600'}`}>
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-3 mb-4 overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-pacific-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-center">
          <p className="text-xl font-bold text-gray-900">{total}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total PCS docs</p>
        </div>
        <div className="rounded-lg bg-green-50 px-3 py-2.5 text-center">
          <p className="text-xl font-bold text-green-700">{extracted}</p>
          <p className="text-xs text-green-600 mt-0.5">Extracted</p>
        </div>
        <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-center">
          <p className="text-xl font-bold text-amber-700">{notStarted}</p>
          <p className="text-xs text-amber-600 mt-0.5">Not started</p>
        </div>
      </div>

      {notStarted > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          {notStarted} doc{notStarted === 1 ? '' : 's'} need{notStarted === 1 ? 's' : ''} uploading via{' '}
          <Link href="/research/pcs/data?tab=imports" className="text-pacific-600 hover:underline">Import</Link>.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Chart: Top Active Ingredients (Tier 2)
// ─────────────────────────────────────────────

function TopIngredientsChart({ data }) {
  const chartData = (data.topIngredients || []).slice(0, 10);

  if (chartData.length === 0) {
    return (
      <ChartCard title="Top Active Ingredients">
        <p className="text-sm text-gray-400 py-8 text-center">No formula lines imported yet</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Top Active Ingredients" toggle={
      <span className="text-xs text-gray-400">by formula-line count</span>
    }>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fontSize: 11 }}
            width={110}
            tickFormatter={v => v.length > 14 ? v.slice(0, 13) + '…' : v}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" name="Formula lines" radius={[0, 4, 4, 0]} fill={COLORS.pacific} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─────────────────────────────────────────────
// Chart: Evidence Type Breakdown (Tier 1)
// Replaces the mostly-empty SQR distribution for non-reviewer roles
// ─────────────────────────────────────────────

function EvidenceTypeChart({ data }) {
  const raw = data.evidenceByType || {};
  const chartData = Object.entries(raw)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }));

  if (chartData.length === 0) {
    return (
      <ChartCard title="Evidence by Type">
        <p className="text-sm text-gray-400 py-8 text-center">No evidence items yet</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Evidence by Type">
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={EVIDENCE_TYPE_COLORS[i % EVIDENCE_TYPE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [value, name]}
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-1.5 min-w-0">
          {chartData.map((entry, i) => (
            <div key={entry.name} className="flex items-center gap-2 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: EVIDENCE_TYPE_COLORS[i % EVIDENCE_TYPE_COLORS.length] }}
              />
              <span className="text-gray-700 truncate flex-1">{entry.name}</span>
              <span className="font-semibold text-gray-900 shrink-0">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

// ─────────────────────────────────────────────
// Chart: Evidence Review Progress (Tier 1)
// ─────────────────────────────────────────────

function EvidenceReviewProgress({ data }) {
  const reviewed = data.sqrReviewedEvidence ?? 0;
  const total = data.totalEvidence ?? 0;
  const unreviewed = total - reviewed;
  const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  const pieData = [
    { name: 'SQR Reviewed', value: reviewed },
    { name: 'Unreviewed', value: unreviewed },
  ];

  return (
    <ChartCard title="Evidence Review Coverage">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={65}
                startAngle={90}
                endAngle={-270}
                paddingAngle={2}
                dataKey="value"
              >
                <Cell fill={COLORS.green} />
                <Cell fill={COLORS.lightGray} />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">{pct}%</p>
              <p className="text-[10px] text-gray-400">reviewed</p>
            </div>
          </div>
        </div>
        <div className="space-y-3 flex-1">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600 font-medium">SQR Reviewed</span>
              <span className="font-bold text-green-700">{reviewed}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="h-1.5 bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600 font-medium">Unreviewed</span>
              <span className="font-bold text-gray-500">{unreviewed}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="h-1.5 bg-gray-400 rounded-full" style={{ width: `${100 - pct}%` }} />
            </div>
          </div>
          {data.avgSqrScore != null && (
            <div className="pt-1 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Avg SQR score: <span className="font-bold text-gray-900">{data.avgSqrScore}</span>
                <span className="text-gray-400"> / 22</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </ChartCard>
  );
}

// ─────────────────────────────────────────────
// Chart: Requests by Type (Tier 2, RA + Admin)
// ─────────────────────────────────────────────

function RequestsByTypeChart({ data }) {
  const raw = data.requestsByType || {};
  const TYPE_LABELS = {
    'missing-field': 'Missing Field',
    'low-confidence': 'Low Confidence',
    'template-drift': 'Template Drift',
    'label-drift': 'Label Drift',
    other: 'Other',
  };
  const TYPE_COLORS = {
    'missing-field': COLORS.red,
    'low-confidence': COLORS.yellow,
    'template-drift': COLORS.orange,
    'label-drift': COLORS.purple,
    other: COLORS.gray,
  };
  const chartData = Object.entries(raw)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => ({ name: TYPE_LABELS[type] || type, type, count }));

  if (chartData.length === 0) {
    return (
      <ChartCard title="Open Requests by Type">
        <p className="text-sm text-gray-400 py-8 text-center">No open requests</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Open Requests by Type">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" name="Requests" radius={[4, 4, 0, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.type} fill={TYPE_COLORS[entry.type] || COLORS.gray} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─────────────────────────────────────────────
// Chart: Claims Pipeline (retained, improved)
// ─────────────────────────────────────────────

function ClaimsPipelineChart({ data }) {
  const [view, setView] = useState('bucket');

  const chartData = useMemo(() => {
    if (view === 'bucket') {
      return Object.entries(data.claimsPipeline || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([bucket, statuses]) => ({ name: bucket, ...statuses }));
    }
    return Object.entries(data.claimsByStatus || {})
      .sort(([, a], [, b]) => b - a)
      .map(([status, count]) => ({ name: status, count }));
  }, [data, view]);

  const statuses = useMemo(() => {
    const all = new Set();
    if (data.claimsPipeline) {
      for (const s of Object.values(data.claimsPipeline)) {
        for (const k of Object.keys(s)) all.add(k);
      }
    }
    return [...all].sort();
  }, [data]);

  return (
    <ChartCard
      title="Claims Pipeline"
      toggle={
        <ViewToggle
          options={[
            { label: 'By Bucket', value: 'bucket' },
            { label: 'By Status', value: 'status' },
          ]}
          value={view}
          onChange={setView}
        />
      }
    >
      <ResponsiveContainer width="100%" height={240}>
        {view === 'bucket' ? (
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            {statuses.map(s => (
              <Bar key={s} dataKey={s} stackId="a" fill={STATUS_COLORS[s] || COLORS.gray} />
            ))}
          </BarChart>
        ) : (
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || COLORS.gray} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─────────────────────────────────────────────
// Chart: SQR Score Distribution
// Shown only for roles with SQR access
// ─────────────────────────────────────────────

function SqrDistributionChart({ data }) {
  const chartData = data.sqrDistribution || [];
  const barColor = (range) => {
    if (range === '17–22') return COLORS.green;
    if (range === '11–16') return COLORS.yellow;
    return COLORS.red;
  };

  return (
    <ChartCard title="SQR Score Distribution">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis dataKey="range" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" name="Items" radius={[4, 4, 0, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.range} fill={barColor(entry.range)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─────────────────────────────────────────────
// Chart: Coverage Heatmap (retained, lazy-loaded)
// ─────────────────────────────────────────────

function CoverageHeatmap({ data }) {
  const [metric, setMetric] = useState('count');
  const buckets = ['3A', '3B', '3C'];
  const rows = data.heatmapData || [];
  if (rows.length === 0) return null;

  function cellColor(value, type) {
    if (value == null || value === 0) return 'bg-gray-50 text-gray-300';
    if (type === 'count') {
      if (value >= 5) return 'bg-green-100 text-green-800';
      if (value >= 2) return 'bg-yellow-100 text-yellow-800';
      return 'bg-red-100 text-red-800';
    }
    if (value >= 17) return 'bg-green-100 text-green-800';
    if (value >= 11) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  }

  return (
    <ChartCard
      title="Ingredient × Evidence Tier Coverage"
      toggle={
        <ViewToggle
          options={[{ label: 'Count', value: 'count' }, { label: 'Avg SQR', value: 'sqr' }]}
          value={metric}
          onChange={setMetric}
        />
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left py-2 px-3 font-semibold text-gray-600">Ingredient</th>
              {buckets.map(b => (
                <th key={b} className="text-center py-2 px-3 font-semibold" style={{ color: BUCKET_COLORS[b] }}>
                  {b}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(row => (
              <tr key={row.ingredient}>
                <td className="py-2 px-3 font-medium text-gray-900">{row.ingredient}</td>
                {buckets.map(b => {
                  const val = metric === 'count' ? row[`${b}_count`] : row[`${b}_avgSqr`];
                  return (
                    <td key={b} className="py-2 px-3 text-center">
                      <span className={`inline-block min-w-[2.5rem] px-2 py-0.5 rounded-md font-medium ${cellColor(val, metric)}`}>
                        {val != null ? val : '—'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

// ─────────────────────────────────────────────
// Loading skeletons
// ─────────────────────────────────────────────

function SkeletonGrid({ kpiCount = 4, chartCount = 4 }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">PCS Command Center</h1>
      <div className={`grid grid-cols-2 md:grid-cols-${kpiCount} gap-4`}>
        {Array.from({ length: kpiCount }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-20 mb-3" />
            <div className="h-7 bg-gray-200 rounded w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-40 mb-4" />
        <div className="h-6 bg-gray-200 rounded mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => <div key={i} className="h-12 bg-gray-100 rounded" />)}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: chartCount }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
            <div className="h-48 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Command Center
// ─────────────────────────────────────────────

export default function PcsCommandCenter() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Role flags — drive which KPI cards and chart panels render
  const isResearcher = hasAnyRole(user, ROLE_SETS.PCS_WRITERS);
  const isAdmin      = hasAnyRole(user, ROLE_SETS.ADMIN_ONLY);
  const isSqrRole    = hasAnyRole(user, ROLE_SETS.SQR_REVIEWERS);
  const isRaRole     = user?.roles?.includes('ra') || user?.roles?.includes('pcs'); // RA or legacy pcs

  useEffect(() => {
    fetch('/api/pcs/dashboard')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load dashboard');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonGrid />;

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">PCS Command Center</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-red-700">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-2 text-sm text-red-600 underline">Retry</button>
        </div>
      </div>
    );
  }

  // ── KPI cards ──────────────────────────────────────────────────────────────
  // Claims-gap KPI: big attention-getter for researchers
  const claimsGapPct = data.totalClaims > 0
    ? Math.round((data.claimsWithoutEvidence / data.totalClaims) * 100)
    : 0;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PCS Command Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">Product Claim Substantiation — Nordic Naturals</p>
        </div>
        <div className="flex gap-2">
          {isSqrRole && (
            <Link href="/research/pcs/review" className="px-4 py-2 bg-pacific-600 text-white rounded-md text-sm font-medium hover:bg-pacific-700 transition-colors">
              Review Queue
            </Link>
          )}
          <Link href="/research/pcs/export" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors">
            Export
          </Link>
        </div>
      </div>

      {/* ── KPI row — role-sensitive ── */}
      {isResearcher && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="PCS Documents"
            value={data.totalDocuments}
            sub={`${data.docExtractionStatus?.extracted ?? 0} extracted`}
            href="/research/pcs/documents"
            accent="pacific"
          />
          <KpiCard
            label="Total Claims"
            value={data.totalClaims}
            sub={`${data.claimsAuthorizedPercent}% authorized`}
            href="/research/pcs/claims"
            accent="green"
          />
          <KpiCard
            label="Claims Without Evidence"
            value={data.claimsWithoutEvidence}
            sub={`${claimsGapPct}% of all claims`}
            href="/research/pcs/claims"
            accent={data.claimsWithoutEvidence > 0 ? 'yellow' : 'green'}
          />
          <KpiCard
            label="Evidence Items"
            value={data.totalEvidence}
            sub={`${data.sqrReviewedEvidence} SQR reviewed`}
            href="/research/pcs/evidence"
            accent="purple"
          />
        </div>
      )}

      {!isResearcher && isSqrRole && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard
            label="Evidence Items"
            value={data.totalEvidence}
            sub={`${data.sqrReviewPercent}% reviewed`}
            href="/research/pcs/evidence"
            accent="purple"
          />
          <KpiCard
            label="Avg SQR Score"
            value={data.avgSqrScore ?? '—'}
            sub={`${data.sqrReviewedEvidence} scored items`}
            accent={(data.avgSqrScore ?? 0) >= 17 ? 'green' : (data.avgSqrScore ?? 0) >= 11 ? 'yellow' : 'blue'}
          />
          <KpiCard
            label="Open Requests"
            value={data.openRequests}
            sub={data.overdueRequests > 0 ? `${data.overdueRequests} overdue` : 'none overdue'}
            href="/research/pcs/requests?open=true"
            accent={data.overdueRequests > 0 ? 'red' : 'gray'}
          />
        </div>
      )}

      {/* ── Full-width: Extraction progress (researchers + admins) ── */}
      {isResearcher && data.docExtractionStatus && (
        <PcsExtractionStatus data={data} />
      )}

      {/* ── Chart grid row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Researcher/RA: Top Ingredients + Evidence Type */}
        {isResearcher && <TopIngredientsChart data={data} />}
        {isResearcher && <EvidenceTypeChart data={data} />}

        {/* Reviewer only: SQR Distribution */}
        {!isResearcher && isSqrRole && <SqrDistributionChart data={data} />}
        {!isResearcher && isSqrRole && <EvidenceReviewProgress data={data} />}
      </div>

      {/* ── Chart grid row 2 (researchers) ── */}
      {isResearcher && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ClaimsPipelineChart data={data} />
          <EvidenceReviewProgress data={data} />
        </div>
      )}

      {/* ── Chart grid row 3 (admin/super-user gets extra panels) ── */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RequestsByTypeChart data={data} />
          <SqrDistributionChart data={data} />
        </div>
      )}

      {/* ── Admin: requests KPI strip ── */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Open Requests"
            value={data.openRequests}
            sub={data.overdueRequests > 0 ? `${data.overdueRequests} overdue` : 'none overdue'}
            href="/research/pcs/requests?open=true"
            accent={data.overdueRequests > 0 ? 'red' : 'gray'}
          />
          <KpiCard
            label="Avg SQR Score"
            value={data.avgSqrScore ?? '—'}
            sub={`${data.sqrReviewedEvidence} scored items`}
            accent={(data.avgSqrScore ?? 0) >= 17 ? 'green' : 'blue'}
          />
          <KpiCard
            label="Under Revision"
            value={data.underRevision}
            sub="docs in active revision"
            href="/research/pcs/documents?view=needs-revision"
            accent={data.underRevision > 0 ? 'yellow' : 'gray'}
          />
          <KpiCard
            label="Evidence Gap"
            value={`${claimsGapPct}%`}
            sub={`${data.claimsWithoutEvidence} claims need evidence`}
            accent={claimsGapPct > 30 ? 'red' : claimsGapPct > 10 ? 'yellow' : 'green'}
          />
        </div>
      )}

      {/* Coverage heatmap — shown when lazy-loaded data is available */}
      {data.heatmapData?.length > 0 && (
        <CoverageHeatmap data={data} />
      )}

    </div>
  );
}
