'use client';

/**
 * DraftLabelCopyPanel — Wave 5.5 side panel for AI-assisted label copy drafting.
 *
 * Renders on the Living PCS View. The user picks a backing Label (from the
 * PCS's related labels), a regulatory framework, tone, and character budget,
 * optionally narrows the claim set, sees an estimated cost, then generates
 * 3 variants per claim. Drafts are ephemeral — never persisted — with a
 * prominent "AI-generated, requires human review" banner.
 *
 * See docs/plans/wave-5-product-labels.md §7.
 */

import { useEffect, useMemo, useState } from 'react';

const FRAMEWORKS = ['FDA (US)', 'Health Canada', 'EU EFSA'];
const TONES = ['clinical', 'consumer', 'athletic'];
const BUDGETS = [
  { value: 'short',  label: 'short (≤25)' },
  { value: 'medium', label: 'medium (≤40)' },
  { value: 'long',   label: 'long (≤80)' },
];

const COST_CONFIRM_THRESHOLD = 1.0;

function estimateClientCost(claimCount) {
  const n = Math.max(0, claimCount | 0);
  const inputTokens = 350 + 120 * n;
  const outputTokens = 300 * n;
  const estUsd =
    (inputTokens / 1_000_000) * 3.0 +
    (outputTokens / 1_000_000) * 15.0;
  return Math.round(estUsd * 10_000) / 10_000;
}

function riskColor(risk) {
  if (risk < 0.3) return { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' };
  if (risk < 0.6) return { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' };
  return { bg: 'bg-rose-100', text: 'text-rose-800', dot: 'bg-rose-500' };
}

export default function DraftLabelCopyPanel({ open, onClose, doc, labels, claims3A }) {
  const [labelId, setLabelId] = useState('');
  const [framework, setFramework] = useState('FDA (US)');
  const [tone, setTone] = useState('consumer');
  const [charBudget, setCharBudget] = useState('medium');
  const [selectedClaimIds, setSelectedClaimIds] = useState(() => new Set());
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [pickedDrafts, setPickedDrafts] = useState(() => new Set());
  const [costConfirmNeeded, setCostConfirmNeeded] = useState(null);

  // Default-select all 3A claims when the panel opens / data changes.
  useEffect(() => {
    if (!open) return;
    setSelectedClaimIds(new Set((claims3A || []).map(c => c.id)));
  }, [open, claims3A]);

  // Pick a default label: first active, else first.
  useEffect(() => {
    if (!open || !Array.isArray(labels) || labels.length === 0) return;
    setLabelId(prev => {
      if (prev && labels.some(l => l.id === prev)) return prev;
      const active = labels.find(l => l.status === 'Active');
      return (active || labels[0]).id;
    });
  }, [open, labels]);

  // Reset transient UI when the panel closes.
  useEffect(() => {
    if (!open) {
      setResult(null);
      setError(null);
      setPickedDrafts(new Set());
      setCostConfirmNeeded(null);
    }
  }, [open]);

  const selectedCount = selectedClaimIds.size;
  const estCost = useMemo(() => estimateClientCost(selectedCount), [selectedCount]);

  const toggleClaim = (id) => {
    setSelectedClaimIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const generate = async ({ confirmCost = false } = {}) => {
    if (!labelId) {
      setError('Pick a backing label.');
      return;
    }
    if (selectedCount === 0) {
      setError('Select at least one claim.');
      return;
    }
    setGenerating(true);
    setError(null);
    setResult(null);
    setCostConfirmNeeded(null);
    try {
      const res = await fetch(`/api/pcs/labels/${labelId}/draft-copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regulatoryFramework: framework,
          tone,
          charBudget,
          claimIds: Array.from(selectedClaimIds),
          confirmCost,
        }),
      });
      const data = await res.json();
      if (res.status === 402 && data?.error === 'cost-confirm-required') {
        setCostConfirmNeeded(data);
      } else if (!res.ok) {
        setError(data?.error || `Request failed (${res.status})`);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err?.message || 'Network error');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  };

  const copyAllForClaim = async (variant) => {
    const text = variant.drafts.map((d, i) => `${i + 1}. ${d.text}`).join('\n');
    await copyToClipboard(text);
  };

  const draftKey = (claimId, idx) => `${claimId}::${idx}`;

  const togglePick = (claimId, idx) => {
    const key = draftKey(claimId, idx);
    setPickedDrafts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const exportPicked = () => {
    if (!result) return;
    const lines = [
      '# AI-drafted label copy — REVIEW BEFORE USE',
      `# PCS: ${doc?.pcsId || '(unknown)'}   Framework: ${result.regulatoryFramework}   Tone: ${result.tone}   Budget: ${result.charBudget}`,
      `# Prompt version: ${result.promptVersion}   Generated: ${result.generatedAt}`,
      '',
    ];
    for (const v of result.variants) {
      const claimLabel = v.sourceClaimNo ? `Claim ${v.sourceClaimNo}` : `Claim ${v.claimId.slice(0, 8)}`;
      const pickedHere = v.drafts
        .map((d, idx) => ({ d, idx }))
        .filter(({ idx }) => pickedDrafts.has(draftKey(v.claimId, idx)));
      if (pickedHere.length === 0) continue;
      lines.push(`## ${claimLabel}: ${v.sourceClaimText}`);
      for (const { d, idx } of pickedHere) {
        lines.push(`- [${idx + 1}] ${d.text}   (risk=${d.regulatoryRisk.toFixed(2)}, ${d.charCount} chars)`);
        for (const w of d.warnings || []) lines.push(`    ! ${w}`);
      }
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `label-copy-drafts-${doc?.pcsId || 'pcs'}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Draft label copy">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Close draft copy panel"
      />
      {/* Panel */}
      <aside className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-xl flex flex-col">
        <header className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Draft label copy</h2>
            <p className="text-xs text-gray-500">AI-assisted variants from approved 3A claims</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
          >
            Close
          </button>
        </header>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Disclaimer banner */}
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <strong>All drafts are AI-generated and require human review.</strong>{' '}
            Nothing on this panel is persisted to Notion. The human always approves before anything reaches a label.
          </div>

          {/* Label selector */}
          <div>
            <label htmlFor="dlc-label" className="block text-xs font-medium text-gray-700 mb-1">
              Backing label
            </label>
            {(labels || []).length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No Product Labels are linked to this PCS yet. Create one before drafting copy.
              </p>
            ) : (
              <select
                id="dlc-label"
                value={labelId}
                onChange={e => setLabelId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              >
                {labels.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.sku} {l.productNameAsMarketed ? `— ${l.productNameAsMarketed}` : ''} {l.status ? `(${l.status})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Framework */}
          <fieldset>
            <legend className="text-xs font-medium text-gray-700 mb-1">Regulatory framework</legend>
            <div className="flex flex-wrap gap-2">
              {FRAMEWORKS.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFramework(f)}
                  className={`px-3 py-1.5 text-xs rounded-md border ${framework === f ? 'bg-pacific-600 text-white border-pacific-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Tone */}
          <fieldset>
            <legend className="text-xs font-medium text-gray-700 mb-1">Tone</legend>
            <div className="flex flex-wrap gap-2">
              {TONES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`px-3 py-1.5 text-xs rounded-md border capitalize ${tone === t ? 'bg-pacific-600 text-white border-pacific-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Budget */}
          <fieldset>
            <legend className="text-xs font-medium text-gray-700 mb-1">Character budget</legend>
            <div className="flex flex-wrap gap-2">
              {BUDGETS.map(b => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => setCharBudget(b.value)}
                  className={`px-3 py-1.5 text-xs rounded-md border ${charBudget === b.value ? 'bg-pacific-600 text-white border-pacific-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Claim picker */}
          <fieldset>
            <legend className="text-xs font-medium text-gray-700 mb-1">
              Approved 3A claims ({claims3A?.length || 0})
            </legend>
            {(!claims3A || claims3A.length === 0) ? (
              <p className="text-sm text-gray-500 italic">
                No 3A-approved claims on the latest version. Drafting needs at least one.
              </p>
            ) : (
              <ul className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
                {claims3A.map(c => (
                  <li key={c.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedClaimIds.has(c.id)}
                      onChange={() => toggleClaim(c.id)}
                      className="mt-0.5"
                      id={`dlc-claim-${c.id}`}
                    />
                    <label htmlFor={`dlc-claim-${c.id}`} className="flex-1 cursor-pointer">
                      <span className="font-mono text-xs text-gray-500 mr-1">{c.claimNo || '—'}</span>
                      <span className="text-gray-800">{c.claim || '(empty)'}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          {/* Cost + Generate */}
          <div className="pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-600 mb-2">
              Estimated cost: <strong>${estCost.toFixed(4)}</strong>{' '}
              for {selectedCount} claim{selectedCount === 1 ? '' : 's'} × 3 variants.
              {estCost > COST_CONFIRM_THRESHOLD && (
                <span className="ml-2 text-amber-700">Exceeds ${COST_CONFIRM_THRESHOLD.toFixed(2)} — confirm before running.</span>
              )}
            </div>
            {costConfirmNeeded && (
              <div className="mb-2 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {costConfirmNeeded.message}{' '}
                <button
                  type="button"
                  className="underline font-medium"
                  onClick={() => generate({ confirmCost: true })}
                  disabled={generating}
                >
                  Confirm and proceed
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => generate()}
              disabled={generating || !labelId || selectedCount === 0}
              className="w-full px-3 py-2 text-sm font-medium rounded-md bg-pacific-600 text-white hover:bg-pacific-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? 'Generating…' : 'Generate 3 variants per claim'}
            </button>
            {error && (
              <p className="mt-2 text-sm text-rose-700">{error}</p>
            )}
          </div>

          {/* Results */}
          {result && (
            <div className="pt-4 border-t border-gray-200 space-y-4">
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <strong>ALL DRAFTS ARE AI-GENERATED AND REQUIRE HUMAN REVIEW.</strong>{' '}
                Prompt: {result.promptVersion} · Model: {result.model}.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportPicked}
                  disabled={pickedDrafts.size === 0}
                  className="text-xs px-2.5 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  Export selected ({pickedDrafts.size})
                </button>
              </div>
              {result.variants.map(v => (
                <section key={v.claimId} className="rounded-md border border-gray-200 p-3">
                  <header className="flex items-baseline justify-between gap-2 mb-2">
                    <div>
                      <div className="text-xs font-mono text-gray-500">
                        Claim {v.sourceClaimNo || v.claimId.slice(0, 8)}
                      </div>
                      <div className="text-sm text-gray-800">{v.sourceClaimText}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyAllForClaim(v)}
                      className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 shrink-0"
                    >
                      Copy all
                    </button>
                  </header>
                  <ul className="space-y-2">
                    {v.drafts.map((d, idx) => {
                      const colors = riskColor(d.regulatoryRisk);
                      const key = draftKey(v.claimId, idx);
                      return (
                        <li key={idx} className="rounded border border-gray-200 p-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-gray-900 flex-1">{d.text}</p>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span
                                title={`Regulatory risk: ${d.regulatoryRisk.toFixed(2)}`}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                                {d.regulatoryRisk.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-gray-500">{d.charCount} chars</span>
                            </div>
                          </div>
                          {d.warnings && d.warnings.length > 0 && (
                            <ul className="mt-1.5 flex flex-wrap gap-1">
                              {d.warnings.map((w, i) => (
                                <li
                                  key={i}
                                  className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200"
                                >
                                  {w}
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(d.text)}
                              className="text-xs px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-50"
                            >
                              Copy
                            </button>
                            <label className="text-xs text-gray-600 flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={pickedDrafts.has(key)}
                                onChange={() => togglePick(v.claimId, idx)}
                              />
                              Include in export
                            </label>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
