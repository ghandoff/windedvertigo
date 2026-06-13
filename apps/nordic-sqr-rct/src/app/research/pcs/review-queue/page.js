'use client';

/**
 * /research/pcs/review-queue — Unified Review Queue
 *
 * Experts see everything awaiting their review across all record types,
 * filterable by type and confidence band.
 *
 * Gated to expert roles: researcher, ra, admin, super-user.
 * The pcs-readonly and reviewer roles cannot approve and see no queue.
 *
 * Spec: docs/expert-in-the-loop-gates-build-prompt.md §2 (Unified Review Queue)
 */

import { useState, useEffect } from 'react';
import RoleRoute from '@/components/RoleRoute.js';
import { GATE_STATUS, GATE_MODES } from '@/lib/review-gate.js';
import { ReviewStatusBadge } from '@/components/ReviewStatusBadge.js';

const MODE_LABEL = {
  [GATE_MODES.HUMAN_FIRST]: 'Human-first',
  [GATE_MODES.HUMAN_FIRST_AI_VERIFY]: 'Human-first + AI verify',
  [GATE_MODES.AI_FIRST_EXPERT_REVIEW]: 'AI-first + expert review',
  [GATE_MODES.AI_AUTO_ABOVE_CONFIDENCE]: 'AI-auto above T',
};

function ConfidenceBadge({ score }) {
  if (score == null) return null;
  const pct = Math.round(score * 100);
  const cls =
    score >= 0.8
      ? 'bg-emerald-50 text-emerald-700'
      : score >= 0.5
      ? 'bg-amber-50 text-amber-700'
      : 'bg-red-50 text-red-700';
  return (
    <span className={`inline-block text-xs rounded px-1.5 py-0.5 font-mono ${cls}`}>
      {pct}%
    </span>
  );
}

function EmptyQueue() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-700">Queue is clear</p>
      <p className="text-xs text-gray-400 mt-1">No records are pending expert review.</p>
    </div>
  );
}

function ReviewQueueContent() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (typeFilter) params.set('type', typeFilter);
    if (confidenceFilter) params.set('confidence', confidenceFilter);

    fetch(`/api/pcs/review/queue?${params}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [typeFilter, confidenceFilter]);

  const RECORD_TYPES = ['pcs-document', 'claim', 'evidence', 'canonical-claim', 'dossier'];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Review Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            Items awaiting expert review — approve, correct, or reject each one.
            Only expert roles (researcher, RA, admin) can approve.
          </p>
        </div>
        {total > 0 && (
          <span className="shrink-0 text-sm font-medium text-gray-700 bg-amber-50 border border-amber-100 rounded-full px-3 py-1">
            {total} pending
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="">All types</option>
          {RECORD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={confidenceFilter}
          onChange={(e) => setConfidenceFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="">All confidence</option>
          <option value="low">Low (&lt;50%)</option>
          <option value="medium">Medium (50–80%)</option>
          <option value="high">High (&gt;80%)</option>
        </select>
      </div>

      {/* Queue */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : items.length === 0 ? (
        <EmptyQueue />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="border border-gray-200 bg-white rounded-lg px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-gray-400 font-mono">{item.recordType}</span>
                  <ReviewStatusBadge
                    status={item.status}
                    approvedBy={item.approvedBy}
                    approvedAt={item.approvedAt}
                  />
                  <ConfidenceBadge score={item.confidenceScore} />
                </div>
                <p className="text-sm text-gray-800 truncate">{item.title ?? item.recordId}</p>
              </div>
              <div className="shrink-0 flex gap-2">
                <button className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status badges reference */}
      <div className="mt-12 border-t border-gray-100 pt-6">
        <h3 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">
          Status badges (appear on every record platform-wide)
        </h3>
        <div className="flex flex-wrap gap-2">
          <ReviewStatusBadge status={GATE_STATUS.PENDING_REVIEW} />
          <ReviewStatusBadge status={GATE_STATUS.APPROVED} approvedBy="Sharon M." approvedAt="2026-06-13" />
          <ReviewStatusBadge status={GATE_STATUS.NEEDS_CHANGES} />
          <ReviewStatusBadge status={GATE_STATUS.REJECTED} />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Records without an "Approved" badge are non-authoritative.
          The badge shows who approved and when.
        </p>
      </div>
    </div>
  );
}

export default function ReviewQueuePage() {
  return (
    <RoleRoute requires={['researcher', 'ra', 'admin', 'super-user']}>
      <ReviewQueueContent />
    </RoleRoute>
  );
}
