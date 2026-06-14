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

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import RoleRoute from '@/components/RoleRoute';
import { useAuth } from '@/lib/useAuth';
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

// ─── Compliance Attribute Matrix ─────────────────────────────────────────────

const COMPLIANCE_STATUS_PILL = {
  yes:         { bg: 'border-green-200 bg-green-50',  text: 'text-green-700',  label: '✓' },
  no:          { bg: 'border-red-200 bg-red-50',      text: 'text-red-600',    label: '✗' },
  conditional: { bg: 'border-amber-200 bg-amber-50',  text: 'text-amber-700',  label: '~' },
  unknown:     { bg: 'border-gray-100 bg-white',      text: 'text-gray-300',   label: '·' },
};

function ComplianceMatrix({ ingredientId, attributes, canEdit, onUpdate }) {
  const [editing, setEditing] = useState(null);
  const [editStatus, setEditStatus] = useState('unknown');
  const [saving, setSaving] = useState(false);

  const handleSave = async (attr) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/pcs/ingredients/${ingredientId}/compliance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attribute: attr, status: editStatus }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || res.statusText);
      }
      const { attribute: updated } = await res.json();
      onUpdate(attr, updated);
      setEditing(null);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!attributes) {
    return <p className="text-xs text-gray-400 italic">Compliance data unavailable — run migration 021 to enable.</p>;
  }

  const attrKeys = Object.keys(attributes);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {attrKeys.map(attr => {
        const rec = attributes[attr] || {};
        const status = rec.status || 'unknown';
        const pill = COMPLIANCE_STATUS_PILL[status] || COMPLIANCE_STATUS_PILL.unknown;
        const isEditing = editing === attr;

        return (
          <div
            key={attr}
            onClick={() => {
              if (!canEdit || isEditing) return;
              setEditing(attr);
              setEditStatus(status);
            }}
            className={`rounded-lg border p-2 text-center transition-colors ${pill.bg} ${canEdit && !isEditing ? 'cursor-pointer hover:border-gray-300' : ''}`}
            title={canEdit && !isEditing ? `Click to edit ${attr}` : attr}
          >
            {isEditing ? (
              <div className="space-y-1" onClick={e => e.stopPropagation()}>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 bg-white"
                  autoFocus
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="conditional">Conditional</option>
                  <option value="unknown">Unknown</option>
                </select>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleSave(attr)}
                    disabled={saving}
                    className="flex-1 text-xs bg-pacific-500 text-white rounded px-1 py-0.5 disabled:opacity-50"
                  >
                    {saving ? '…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 px-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span className={`inline-block text-sm font-bold ${pill.text}`}>{pill.label}</span>
                <p className="text-xs text-gray-600 mt-0.5 leading-tight">{attr}</p>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── AI Research Chat Panel ───────────────────────────────────────────────────

function AiChatPanel({ ingredientId, ingredientName, open, onClose, messages, input, onInputChange, onSend, sending }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  if (!open) return null;

  const suggestionPrompts = [
    `What dose of ${ingredientName} is needed to support sleep?`,
    `Which claims for ${ingredientName} are FDA-applicable?`,
    `What's the evidence quality for ${ingredientName} cardiovascular claims?`,
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-pacific-200 bg-pacific-600 text-white">
          <div>
            <p className="font-semibold text-sm">AI Research Assistant</p>
            <p className="text-xs text-pacific-200">{ingredientName} · Nordic PCS data only</p>
          </div>
          <button onClick={onClose} className="text-pacific-200 hover:text-white text-lg leading-none ml-4">✕</button>
        </div>

        {/* Disclaimer */}
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
          <p className="text-xs text-amber-700">
            Responses are grounded in Nordic's PCS claims and SQR-RCT scored evidence — not the web.
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 mb-3">Ask about {ingredientName}</p>
              <div className="space-y-1.5 text-left">
                {suggestionPrompts.map(q => (
                  <button
                    key={q}
                    onClick={() => onInputChange(q)}
                    className="w-full text-left text-xs text-pacific-600 hover:text-pacific-800 bg-pacific-50 hover:bg-pacific-100 border border-pacific-100 rounded px-3 py-2 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-sm rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-pacific-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {msg.content || (sending && i === messages.length - 1
                  ? <span className="text-gray-400 italic text-xs">Thinking…</span>
                  : null)}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask about ${ingredientName}…`}
              rows={2}
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pacific-400"
            />
            <button
              onClick={onSend}
              disabled={!input.trim() || sending}
              className="bg-pacific-600 hover:bg-pacific-700 text-white text-sm font-medium px-4 py-2 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? '…' : '→'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function IngredientDashboardContent() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [region, setRegion] = useState('');

  // Phase 3 — Compliance attributes
  const [compliance, setCompliance] = useState(null);
  const [complianceLoading, setComplianceLoading] = useState(false);

  // Phase 4 — AI Research Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);

  const load = useCallback((reg) => {
    setLoading(true);
    const url = `/api/pcs/caipb/ingredient/${id}${reg ? `?region=${encodeURIComponent(reg)}` : ''}`;
    fetch(url)
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e.error)))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [id]);

  useEffect(() => { load(region); }, [load, region]);

  // Fetch compliance attributes once on mount
  useEffect(() => {
    if (!id) return;
    setComplianceLoading(true);
    fetch(`/api/pcs/ingredients/${id}/compliance`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setCompliance(d?.attributes || null); setComplianceLoading(false); })
      .catch(() => setComplianceLoading(false));
  }, [id]);

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatSending) return;
    const userMsg = { role: 'user', content: text };
    const assistantMsg = { role: 'assistant', content: '' };
    setChatMessages(prev => [...prev, userMsg, assistantMsg]);
    setChatInput('');
    setChatSending(true);
    try {
      const res = await fetch('/api/pcs/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, userMsg],
          context: { ingredientId: id },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          setChatMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + chunk,
            };
            return updated;
          });
        }
      }
    } catch (err) {
      setChatMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: `Error: ${err.message}` };
        return updated;
      });
    } finally {
      setChatSending(false);
    }
  };

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

        {/* Phase 3 — Compliance Attribute Matrix */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Compliance Attributes</h2>
          {complianceLoading ? (
            <p className="text-xs text-gray-400 italic">Loading…</p>
          ) : (
            <ComplianceMatrix
              ingredientId={id}
              attributes={compliance}
              canEdit={user?.capabilities?.includes('pcs.taxonomy:edit')}
              onUpdate={(attr, updated) => setCompliance(prev => ({
                ...prev,
                [attr]: updated,
              }))}
            />
          )}
        </div>

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

        {/* Phase 4 — AI Research Chat */}
        <AiChatPanel
          ingredientId={id}
          ingredientName={ingredient.canonicalName}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          messages={chatMessages}
          input={chatInput}
          onInputChange={setChatInput}
          onSend={sendChatMessage}
          sending={chatSending}
        />

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

        {/* Phase 4 — Floating AI chat button */}
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-pacific-600 hover:bg-pacific-700 text-white text-sm font-medium px-4 py-3 rounded-full shadow-lg transition-colors"
        >
          <span>✦</span>
          <span>Ask AI</span>
        </button>
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
