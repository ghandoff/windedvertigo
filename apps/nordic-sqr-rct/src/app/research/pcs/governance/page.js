'use client';

/**
 * /research/pcs/governance — Governance & Metrics Dashboard (Module G)
 *
 * Super-user-only. Ships with governance OFF so it can be walked through as a
 * tutorial with leadership before activating. When OFF, the gates still function
 * and audit history is captured quietly. When ON, rules enforce, this dashboard
 * and its metrics are shown to the full team.
 *
 * Spec: docs/expert-in-the-loop-gates-build-prompt.md §5
 */

import { useState, useEffect, useCallback } from 'react';
import RoleRoute from '@/components/RoleRoute.js';
import {
  GATE_MODES,
  DEFAULT_TIME_BASELINES_MINUTES,
} from '@/lib/review-gate.js';

// ─── Status badge ─────────────────────────────────────────────────────────────

function GovernanceBadge({ enabled }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
        enabled
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-gray-100 text-gray-600'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
      {enabled ? 'Governance ON' : 'Governance OFF'}
    </span>
  );
}

// ─── Rule card ────────────────────────────────────────────────────────────────

function RuleCard({ rule, onToggle, canEdit }) {
  const modeLabel = {
    [GATE_MODES.HUMAN_FIRST]: 'Human-first',
    [GATE_MODES.HUMAN_FIRST_AI_VERIFY]: 'Human-first + AI verify',
    [GATE_MODES.AI_FIRST_EXPERT_REVIEW]: 'AI-first + expert review',
    [GATE_MODES.AI_AUTO_ABOVE_CONFIDENCE]: 'AI-auto above confidence T',
  };

  return (
    <div className={`border rounded-lg p-4 ${rule.active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-gray-900">{rule.recordType}</span>
            {rule.requiredMode && (
              <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 font-medium">
                {modeLabel[rule.requiredMode] ?? rule.requiredMode}
              </span>
            )}
            {rule.requireDualReview && (
              <span className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-700 font-medium">
                Dual review
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">{rule.description}</p>
        </div>
        {canEdit && (
          <button
            onClick={() => onToggle(rule)}
            className={`shrink-0 text-xs px-2.5 py-1 rounded border transition-colors ${
              rule.active
                ? 'border-gray-200 text-gray-600 hover:bg-red-50 hover:border-red-200 hover:text-red-700'
                : 'border-gray-200 text-gray-400 hover:bg-green-50 hover:border-green-200 hover:text-green-700'
            }`}
          >
            {rule.active ? 'Disable' : 'Enable'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── New rule form ────────────────────────────────────────────────────────────

function NewRuleForm({ onSave, onCancel }) {
  const [form, setForm] = useState({
    recordType: 'pcs-document',
    requiredMode: '',
    requireDualReview: false,
    description: '',
  });

  const RECORD_TYPES = ['pcs-document', 'claim', 'evidence', 'canonical-claim', 'dossier'];

  return (
    <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
      <h4 className="font-medium text-sm text-blue-900 mb-3">New Gate Rule</h4>
      <div className="grid gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Record type</label>
          <select
            value={form.recordType}
            onChange={(e) => setForm((f) => ({ ...f, recordType: e.target.value }))}
            className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {RECORD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Required mode (optional)</label>
          <select
            value={form.requiredMode}
            onChange={(e) => setForm((f) => ({ ...f, requiredMode: e.target.value }))}
            className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">Any mode (no enforcement)</option>
            {Object.values(GATE_MODES).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="dual-review"
            checked={form.requireDualReview}
            onChange={(e) => setForm((f) => ({ ...f, requireDualReview: e.target.checked }))}
            className="rounded border-gray-300"
          />
          <label htmlFor="dual-review" className="text-xs text-gray-700">Require dual review</label>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            placeholder="Why this rule exists and what it enforces..."
            className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onSave(form)}
          disabled={!form.description.trim()}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save rule
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Metrics panel ────────────────────────────────────────────────────────────

function MetricsPanel({ metrics }) {
  if (!metrics) return null;

  const { correctionRate, timeSaved, adherence, _note } = metrics;

  if (_note && correctionRate?.overall?.total === 0) {
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-500">
        {_note}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="rounded-lg border border-gray-100 bg-white p-4">
        <div className="text-xs text-gray-500 mb-1">Reviews total</div>
        <div className="text-2xl font-semibold text-gray-900">{correctionRate?.overall?.total ?? 0}</div>
      </div>
      <div className="rounded-lg border border-gray-100 bg-white p-4">
        <div className="text-xs text-gray-500 mb-1">Correction rate</div>
        <div className="text-2xl font-semibold text-gray-900">
          {correctionRate?.overall?.total > 0
            ? `${Math.round((correctionRate.overall.rate ?? 0) * 100)}%`
            : '—'}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">AI output changed by expert</div>
      </div>
      <div className="rounded-lg border border-gray-100 bg-white p-4">
        <div className="text-xs text-gray-500 mb-1">Time saved (est.)</div>
        <div className="text-2xl font-semibold text-gray-900">
          {timeSaved?.totalSavedHours > 0
            ? `~${timeSaved.totalSavedHours.toFixed(1)}h`
            : '—'}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">vs. full manual entry</div>
      </div>
      <div className="rounded-lg border border-gray-100 bg-white p-4">
        <div className="text-xs text-gray-500 mb-1">Rubber-stamps</div>
        <div className={`text-2xl font-semibold ${(correctionRate?.rubberStamps ?? 0) > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
          {correctionRate?.rubberStamps ?? 0}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">Approved in &lt;8s, unchanged</div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function GovernanceContent() {
  const [config, setConfig] = useState(null);
  const [rules, setRules] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [showNewRule, setShowNewRule] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfgRes, rulesRes, metricsRes] = await Promise.all([
        fetch('/api/pcs/governance'),
        fetch('/api/pcs/governance/rules'),
        fetch('/api/pcs/governance/metrics?period=30d'),
      ]);
      if (!cfgRes.ok) throw new Error(`Governance config: ${cfgRes.status}`);
      if (!rulesRes.ok) throw new Error(`Rules: ${rulesRes.status}`);
      if (!metricsRes.ok) throw new Error(`Metrics: ${metricsRes.status}`);
      const [cfg, rulesData, metricsData] = await Promise.all([
        cfgRes.json(),
        rulesRes.json(),
        metricsRes.json(),
      ]);
      setConfig(cfg);
      setRules(rulesData.rules ?? []);
      setMetrics(metricsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleToggle = async () => {
    if (!config) return;
    setToggling(true);
    try {
      const res = await fetch('/api/pcs/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ governanceEnabled: !config.isEnabled }),
      });
      if (!res.ok) throw new Error(`Toggle failed: ${res.status}`);
      const updated = await res.json();
      setConfig(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setToggling(false);
    }
  };

  const handleSaveRule = async (form) => {
    setSavingRule(true);
    try {
      const res = await fetch('/api/pcs/governance/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`Save rule failed: ${res.status}`);
      const { rule } = await res.json();
      setRules((prev) => [...prev, rule]);
      setShowNewRule(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingRule(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">Loading governance dashboard…</div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Governance & Review Metrics ✦</h1>
          <p className="text-sm text-gray-500 mt-1">
            Super-user control panel for the expert-in-the-loop gate system.
          </p>
        </div>
        <GovernanceBadge enabled={config?.isEnabled} />
      </div>

      {/* Governance toggle */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-medium text-gray-900 mb-1">Governance layer</h2>
            <p className="text-sm text-gray-500 max-w-prose">
              When <strong>OFF</strong>: gates still function and review history is captured quietly
              in the background. Rules are defined but not enforced. The dashboard and metrics are
              only visible to super-users.
            </p>
            <p className="text-sm text-gray-500 max-w-prose mt-1">
              When <strong>ON</strong>: rules enforce, and the full dashboard with metrics becomes
              visible to the team. Walk through this as a tutorial with leadership before activating.
            </p>
          </div>
          <div className="shrink-0">
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 ${
                config?.isEnabled
                  ? 'border-red-200 text-red-700 bg-red-50 hover:bg-red-100'
                  : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
              }`}
            >
              {toggling ? 'Saving…' : config?.isEnabled ? 'Turn OFF' : 'Turn ON'}
            </button>
          </div>
        </div>
        {config?.toggledAt && (
          <p className="text-xs text-gray-400 mt-4 border-t border-gray-100 pt-3">
            Last toggled {new Date(config.toggledAt).toLocaleString()} by {config.toggledBy}
          </p>
        )}
      </section>

      {/* Metrics — last 30 days */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-gray-900">Metrics — last 30 days</h2>
          {!config?.isEnabled && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded px-2 py-0.5">
              Preview (governance OFF — visible to super-users only)
            </span>
          )}
        </div>
        {metrics && (
          <>
            <MetricsPanel metrics={metrics} />
            {metrics.timeSaved?.assumptions && (
              <p className="text-xs text-gray-400 mt-2">
                * {metrics.timeSaved.assumptions.note}
              </p>
            )}
          </>
        )}
      </section>

      {/* Gate rules */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-medium text-gray-900">Gate rules</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Define which review mode applies per record type. Admin and RA can create rules;
              enforcement is active when governance is ON.
            </p>
          </div>
          <button
            onClick={() => setShowNewRule(true)}
            className="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            + New rule
          </button>
        </div>

        <div className="space-y-3">
          {showNewRule && (
            <NewRuleForm
              onSave={handleSaveRule}
              onCancel={() => setShowNewRule(false)}
            />
          )}
          {rules.length === 0 && !showNewRule && (
            <div className="text-sm text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-lg">
              No rules defined yet. Add a rule to specify which mode applies per record type.
            </div>
          )}
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              canEdit={true}
              onToggle={(r) => {
                setRules((prev) =>
                  prev.map((x) => x.id === r.id ? { ...x, active: !x.active } : x)
                );
              }}
            />
          ))}
        </div>
      </section>

      {/* Time-saved assumptions */}
      <section className="rounded-xl border border-gray-100 bg-gray-50 p-5">
        <h2 className="font-medium text-gray-700 mb-2 text-sm">Time-saved assumptions</h2>
        <p className="text-xs text-gray-500 mb-3">
          These baselines represent assumed manual-entry time per record type. Calibrate with
          Sharon's team against real data. The time-saved figure is always shown as an estimate.
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-200">
              <th className="pb-2 font-medium">Record type</th>
              <th className="pb-2 font-medium text-right">Baseline (min)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(DEFAULT_TIME_BASELINES_MINUTES).filter(([k]) => k !== 'default').map(([type, mins]) => (
              <tr key={type} className="border-b border-gray-100">
                <td className="py-1.5 text-gray-600">{type}</td>
                <td className="py-1.5 text-right text-gray-600">{mins} min</td>
              </tr>
            ))}
            <tr>
              <td className="py-1.5 text-gray-400">All others (default)</td>
              <td className="py-1.5 text-right text-gray-400">{DEFAULT_TIME_BASELINES_MINUTES.default} min</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default function GovernancePage() {
  return (
    <RoleRoute requires={['super-user']}>
      <GovernanceContent />
    </RoleRoute>
  );
}
