'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

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

const TYPE_COLORS = {
  RCT: '#2563EB',
  'Meta-analysis': '#7C3AED',
  'Systematic review': '#0891B2',
  Observational: '#CA8A04',
  'In vitro': '#16A34A',
  Animal: '#EA580C',
  Mechanistic: '#6366F1',
  Review: '#64748B',
  Other: '#9CA3AF',
};

const BUCKET_COLORS = { '3A': COLORS.green, '3B': COLORS.yellow, '3C': COLORS.red };

// ─────────────────────────────────────────────
// Shared components
// ─────────────────────────────────────────────

function KpiCard({ label, value, sub, href, accent = 'gray' }) {
  const accents = {
    gray: 'border-l-gray-300',
    blue: 'border-l-blue-500',
    green: 'border-l-green-500',
    yellow: 'border-l-yellow-500',
    red: 'border-l-red-500',
    purple: 'border-l-purple-500',
  };
  const card = (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${accents[accent]} p-4 ${href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
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

function ChartCard({ title, toggle, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
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
// Chart: Claims Pipeline
// ─────────────────────────────────────────────

function ClaimsPipelineChart({ data, claimsByStatus }) {
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
      for (const statuses of Object.values(data.claimsPipeline)) {
        for (const s of Object.keys(statuses)) all.add(s);
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
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {statuses.map(s => (
              <Bar key={s} dataKey={s} stackId="a" fill={STATUS_COLORS[s] || COLORS.gray} radius={[0, 0, 0, 0]} />
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
// Chart: Evidence Composition (Donut)
// ─────────────────────────────────────────────

function EvidenceDonutChart({ data }) {
  const [view, setView] = useState('type');

  const chartData = useMemo(() => {
    const source = view === 'type' ? data.evidenceByType : data.evidenceByReviewStatus;
    return Object.entries(source || {})
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));
  }, [data, view]);

  const colorMap = view === 'type' ? TYPE_COLORS : { Reviewed: COLORS.green, Unreviewed: COLORS.lightGray };

  return (
    <ChartCard
      title="Evidence Library"
      toggle={
        <ViewToggle
          options={[
            { label: 'By Type', value: 'type' },
            { label: 'Review Status', value: 'review' },
          ]}
          value={view}
          onChange={setView}
        />
      }
    >
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map(entry => (
              <Cell key={entry.name} fill={colorMap[entry.name] || COLORS.gray} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const { name, value } = payload[0].payload;
              const total = chartData.reduce((s, d) => s + d.value, 0);
              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
                  <p className="font-medium">{name}</p>
                  <p className="text-gray-500">{value} ({Math.round(value / total * 100)}%)</p>
                </div>
              );
            }}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            wrapperStyle={{ fontSize: 11, paddingLeft: 16 }}
            formatter={(value, entry) => {
              const item = chartData.find(d => d.name === value);
              return `${value} (${item?.value || 0})`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─────────────────────────────────────────────
// Chart: SQR Score Distribution
// ─────────────────────────────────────────────

function SqrDistributionChart({ data }) {
  const chartData = data.sqrDistribution || [];

  const barColor = (range) => {
    if (range === '17–22') return COLORS.green;
    if (range === '11–16') return COLORS.yellow;
    return COLORS.red; // 0–10
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
// Chart: Coverage Heatmap
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
    // avgSqr
    if (value >= 17) return 'bg-green-100 text-green-800';
    if (value >= 11) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  }

  return (
    <ChartCard
      title="Ingredient × Evidence Tier Coverage"
      toggle={
        <ViewToggle
          options={[
            { label: 'Count', value: 'count' },
            { label: 'Avg SQR', value: 'sqr' },
          ]}
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
// Activity Feed
// ─────────────────────────────────────────────

const ACTIVITY_CONFIG = {
  document: { label: 'Doc', color: 'bg-blue-100 text-blue-700', href: (id) => `/pcs/documents/${id}` },
  claim: { label: 'Claim', color: 'bg-green-100 text-green-700', href: (id) => `/pcs/claims/${id}` },
  evidence: { label: 'Evidence', color: 'bg-purple-100 text-purple-700', href: (id) => `/pcs/evidence/${id}` },
  request: { label: 'Request', color: 'bg-red-100 text-red-700', href: () => `/pcs/requests` },
  version: { label: 'Version', color: 'bg-yellow-100 text-yellow-700', href: () => `/pcs/documents` },
};

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function ActivityFeed() {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pcs/activity?limit=15')
      .then(res => res.ok ? res.json() : { activity: [] })
      .then(data => setActivity(data.activity || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (activity.length === 0) return <p className="text-sm text-gray-400">No recent activity</p>;

  return (
    <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
      {activity.map(item => {
        const cfg = ACTIVITY_CONFIG[item.type] || ACTIVITY_CONFIG.document;
        return (
          <Link
            key={item.id}
            href={cfg.href(item.id)}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
          >
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cfg.color}`}>
              {cfg.label}
            </span>
            <span className="text-sm text-gray-900 truncate flex-1">{item.title}</span>
            <span className="text-xs text-gray-400 shrink-0">
              {item.isNew ? 'created' : 'edited'} {timeAgo(item.lastEditedTime)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Command Center
// ─────────────────────────────────────────────

export default function PcsCommandCenter() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">PCS Command Center</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-20 mb-3" />
              <div className="h-7 bg-gray-200 rounded w-12" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
              <div className="h-48 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">PCS Command Center</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-red-700">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-2 text-sm text-red-600 underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PCS Command Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">Product Claim Substantiation — Nordic Naturals</p>
        </div>
        <div className="flex gap-2">
          <Link href="/pcs/review" className="px-4 py-2 bg-pacific-600 text-white rounded-md text-sm font-medium hover:bg-pacific-700 transition-colors">
            Review Queue
          </Link>
          <Link href="/pcs/export" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors">
            Export
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Evidence Items"
          value={data.totalEvidence}
          sub={`${data.sqrReviewedEvidence} SQR reviewed`}
          href="/pcs/evidence"
          accent="purple"
        />
        <KpiCard
          label="Total Claims"
          value={data.totalClaims}
          sub={`${data.claimsAuthorizedPercent}% authorized`}
          href="/pcs/claims"
          accent="green"
        />
        <KpiCard
          label="Open Requests"
          value={data.openRequests}
          sub={data.overdueRequests > 0 ? `${data.overdueRequests} overdue` : 'none overdue'}
          href="/pcs/requests?open=true"
          accent={data.overdueRequests > 0 ? 'red' : 'gray'}
        />
        <KpiCard
          label="Avg SQR Score"
          value={data.avgSqrScore ?? '—'}
          sub={`${data.sqrReviewedEvidence} scored items`}
          accent={(data.avgSqrScore ?? 0) >= 17 ? 'green' : (data.avgSqrScore ?? 0) >= 11 ? 'yellow' : 'blue'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ClaimsPipelineChart data={data} />
        <SqrDistributionChart data={data} />
      </div>

      {/* Recent Activity */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
        <ActivityFeed />
      </div>
    </div>
  );
}
