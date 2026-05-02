'use client';

/**
 * Wave 8.1 — Canonical Claim Dedupe Review
 *
 * Gina (and any capable operator) opens this page to resolve the duplicate
 * clusters surfaced by the Wave 7.0.5 T2 canonical-identity-key backfill.
 * Each cluster is rendered as a card with all member rows inline; the
 * `Dedupe decision` dropdown routes through the shared InlineEditField +
 * `/api/admin/pcs/canonical-claims/[id]` PATCH endpoint (capability
 * `pcs.canonical:edit` — Researcher / RA / Admin / Super-user).
 *
 * Design principles:
 *   1. DPO isolation. All writes flow through PCS API routes. Nothing here
 *      talks to Notion directly.
 *   2. Single surface. Gina does not leave the PCS web app to review or
 *      decide — the rows she edits ARE the Notion rows, just wrapped in
 *      a platform-owned UX.
 *   3. Contextual, not bulk. Every row gets its own decision. Future bulk
 *      actions ("mark all members of this cluster for review") can layer
 *      on top; MVP is per-row.
 *
 * The merge execution itself is T8.1 (separate script, runs after decisions
 * land). This page produces the decisions; the script consumes them.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';
import InlineEditField from '@/components/pcs/InlineEditField';

const DEDUPE_DECISION_OPTIONS = [
  { value: 'keep-survivor',      label: 'Keep this (survivor)' },
  { value: 'retire-into-other',  label: 'Retire into survivor' },
  { value: 'archive',            label: 'Archive entirely' },
  { value: 'actually-different', label: 'Actually different (false positive)' },
  { value: 'needs-more-info',    label: 'Needs more info' },
];

const DECISION_BADGE = {
  'keep-survivor':      { label: 'Survivor',       color: 'bg-green-100 text-green-800 border-green-300' },
  'retire-into-other':  { label: 'Retire',         color: 'bg-red-100 text-red-800 border-red-300' },
  'archive':            { label: 'Archive',        color: 'bg-gray-200 text-gray-800 border-gray-400' },
  'actually-different': { label: 'Not a dup',      color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  'needs-more-info':    { label: 'Needs info',     color: 'bg-blue-100 text-blue-800 border-blue-300' },
};

const ORPHAN_KEY = 'v1:::::not_applicable::';

// Filter options for the top toolbar.
const FILTER_ALL       = 'all';
const FILTER_UNDECIDED = 'undecided';
const FILTER_DECIDED   = 'decided';
const FILTER_ORPHAN    = 'orphan';

export default function DedupeReviewPage() {
  const { user, loading: authLoading } = useAuth();
  const [claims, setClaims] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState(FILTER_ALL);

  const canEdit = hasAnyRole(user, ROLE_SETS.PCS_WRITERS);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/pcs/canonical-claims', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => { if (!cancelled) setClaims(Array.isArray(data) ? data : []); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  // Group by canonical key. Clusters are groups of 2+ rows with the same key.
  // Orphan cluster (the degenerate v1:::::not_applicable:: key) is separated
  // because it represents "missing taxonomy" rather than "real duplicates."
  const { clusters, orphanMembers, soloCount } = useMemo(() => {
    if (!Array.isArray(claims)) return { clusters: [], orphanMembers: [], soloCount: 0 };
    const byKey = new Map();
    for (const c of claims) {
      const key = c.canonicalKey || '';
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(c);
    }
    const out = [];
    let soloCount = 0;
    let orphanMembers = [];
    for (const [key, members] of byKey.entries()) {
      if (!key) { soloCount += members.length; continue; }
      if (key === ORPHAN_KEY) { orphanMembers = members; continue; }
      if (members.length <= 1) { soloCount += members.length; continue; }
      // Sort order:
      //   1. Survivor first (if marked)
      //   2. Most downstream PCS-claim references next (the "natural survivor"
      //      heuristic — merging INTO the row with the most references
      //      minimizes disruption)
      //   3. Oldest by createdTime
      members.sort((a, b) => {
        if (a.dedupeDecision === 'keep-survivor' && b.dedupeDecision !== 'keep-survivor') return -1;
        if (b.dedupeDecision === 'keep-survivor' && a.dedupeDecision !== 'keep-survivor') return 1;
        const aRefs = a.pcsClaimInstanceIds?.length || 0;
        const bRefs = b.pcsClaimInstanceIds?.length || 0;
        if (aRefs !== bRefs) return bRefs - aRefs;
        return (a.createdTime || '').localeCompare(b.createdTime || '');
      });
      out.push({ key, members, sensitivity: members[0]?.doseSensitivityApplied || 'unknown' });
    }
    // Cluster sort: largest first, then alpha by first member title
    out.sort((a, b) => b.members.length - a.members.length
      || (a.members[0]?.canonicalClaim || '').localeCompare(b.members[0]?.canonicalClaim || ''));
    return { clusters: out, orphanMembers, soloCount };
  }, [claims]);

  const summary = useMemo(() => {
    if (!claims) return null;
    const allMembers = clusters.flatMap((c) => c.members);
    const decided = allMembers.filter((m) => !!m.dedupeDecision).length;
    const undecided = allMembers.length - decided;
    const clustersFullyDecided = clusters.filter((c) => c.members.every((m) => !!m.dedupeDecision)).length;
    return {
      totalClusters: clusters.length,
      clustersFullyDecided,
      clustersNeedingAttention: clusters.length - clustersFullyDecided,
      totalDupRows: allMembers.length,
      decided,
      undecided,
      orphanCount: orphanMembers.length,
      soloCount,
    };
  }, [claims, clusters, orphanMembers, soloCount]);

  function handleRowUpdated(updatedRow) {
    // Patch the local cache so the filter + badges re-render without a refetch.
    setClaims((prev) => {
      if (!Array.isArray(prev)) return prev;
      return prev.map((c) => (c.id === updatedRow.id ? { ...c, ...updatedRow } : c));
    });
  }

  const visibleClusters = useMemo(() => {
    if (filter === FILTER_ORPHAN) return [];
    if (filter === FILTER_UNDECIDED) return clusters.filter((c) => c.members.some((m) => !m.dedupeDecision));
    if (filter === FILTER_DECIDED)   return clusters.filter((c) => c.members.every((m) => !!m.dedupeDecision));
    return clusters;
  }, [clusters, filter]);

  if (authLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  }
  if (!user) {
    return <div className="p-6 text-sm text-red-700">You must be signed in.</div>;
  }
  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-700">Could not load canonical claims: {error}</p>
      </div>
    );
  }
  if (!claims) {
    return <div className="p-6 text-sm text-gray-500">Loading clusters…</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <nav className="text-xs text-gray-500 mb-1">
            <Link href="/pcs" className="hover:underline">Command Center</Link>
            <span className="mx-1">/</span>
            <span>Canonical Claims</span>
            <span className="mx-1">/</span>
            <span className="text-gray-700">Dedupe Review</span>
          </nav>
          <h1 className="text-2xl font-semibold text-gray-900">Canonical Claim Dedupe Review</h1>
          <p className="mt-1 text-sm text-gray-600 max-w-2xl">
            Duplicate clusters surfaced by the canonical-identity-key audit.
            Pick one row per cluster as the survivor; mark the rest as retired,
            archived, or false-positive. The <strong>Links</strong> column
            shows how many PCS claim instances already reference each row —
            the row marked <span className="text-blue-700">★</span> is the
            most-referenced (usually the best survivor choice; merging into
            it causes the least disruption).
          </p>
        </div>
        {!canEdit && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            You have read access only. Decisions require Researcher / RA / Admin.
          </div>
        )}
      </header>

      {summary && (
        <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <SummaryTile label="Clusters"                 value={summary.totalClusters}           />
          <SummaryTile label="Fully decided"            value={summary.clustersFullyDecided} accent="green" />
          <SummaryTile label="Needs attention"          value={summary.clustersNeedingAttention} accent="amber" />
          <SummaryTile label="Rows in clusters"         value={summary.totalDupRows}              />
          <SummaryTile label="Undecided rows"           value={summary.undecided} accent={summary.undecided > 0 ? 'amber' : 'green'} />
        </section>
      )}

      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600">Filter:</span>
        <FilterBtn active={filter === FILTER_ALL}       onClick={() => setFilter(FILTER_ALL)}>All clusters</FilterBtn>
        <FilterBtn active={filter === FILTER_UNDECIDED} onClick={() => setFilter(FILTER_UNDECIDED)}>Needs attention</FilterBtn>
        <FilterBtn active={filter === FILTER_DECIDED}   onClick={() => setFilter(FILTER_DECIDED)}>Fully decided</FilterBtn>
        <FilterBtn active={filter === FILTER_ORPHAN}    onClick={() => setFilter(FILTER_ORPHAN)}>Orphan cluster ({orphanMembers.length})</FilterBtn>
      </div>

      {filter === FILTER_ORPHAN ? (
        <OrphanClusterCard members={orphanMembers} />
      ) : visibleClusters.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          No clusters match this filter.
        </div>
      ) : (
        <div className="space-y-4">
          {visibleClusters.map((cluster, idx) => (
            <ClusterCard
              key={cluster.key}
              index={idx + 1}
              cluster={cluster}
              canEdit={canEdit}
              onRowUpdated={handleRowUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, accent }) {
  const accentColor = accent === 'green' ? 'text-green-700'
    : accent === 'amber' ? 'text-amber-700'
    : 'text-gray-900';
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold mt-0.5 ${accentColor}`}>{value}</p>
    </div>
  );
}

function FilterBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md border text-xs ${
        active
          ? 'bg-pacific-600 text-white border-pacific-600'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

function ClusterCard({ index, cluster, canEdit, onRowUpdated }) {
  const fullyDecided = cluster.members.every((m) => !!m.dedupeDecision);
  const hasSurvivor = cluster.members.some((m) => m.dedupeDecision === 'keep-survivor');
  const survivorCount = cluster.members.filter((m) => m.dedupeDecision === 'keep-survivor').length;
  const warningAmbiguous = survivorCount > 1;

  return (
    <section className="rounded-md border border-gray-200 bg-white">
      <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              Cluster {index} · {cluster.members.length} rows
            </h2>
            <span className="text-xs text-gray-500">sensitivity:</span>
            <code className="text-xs bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
              {cluster.sensitivity}
            </code>
          </div>
          <p className="mt-1 text-xs text-gray-500 font-mono truncate" title={cluster.key}>
            key: {cluster.key}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {warningAmbiguous && (
            <span className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs text-red-800">
              Multiple survivors picked
            </span>
          )}
          {fullyDecided && !warningAmbiguous && (
            <span className="rounded border border-green-300 bg-green-50 px-2 py-0.5 text-xs text-green-800">
              Decided
            </span>
          )}
          {!fullyDecided && hasSurvivor && (
            <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
              Partial
            </span>
          )}
        </div>
      </header>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left">Title</th>
            <th className="px-3 py-2 text-left" title="Number of PCS claim instances linked to this canonical. Survivor should usually be the row with the most.">Links</th>
            <th className="px-3 py-2 text-left">Family</th>
            <th className="px-3 py-2 text-left">Created</th>
            <th className="px-3 py-2 text-left">Decision</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Notion</th>
          </tr>
        </thead>
        <tbody>
          {cluster.members.map((m, idx) => {
            const refCount = m.pcsClaimInstanceIds?.length || 0;
            const mostReferenced = idx === 0 && cluster.members.length > 1
              && refCount > 0
              && refCount > (cluster.members[1]?.pcsClaimInstanceIds?.length || 0);
            return (
              <tr key={m.id} className="border-t border-gray-100 align-top">
                <td className="px-3 py-2 text-gray-900">
                  <div className="flex items-start gap-2">
                    <span>
                      {m.canonicalClaim || <em className="text-gray-400">no title</em>}
                    </span>
                    {m.notesGuardrails && (
                      <span
                        className="text-xs text-gray-400 cursor-help shrink-0"
                        title={m.notesGuardrails}
                        aria-label={`Notes: ${m.notesGuardrails}`}
                      >
                        ℹ
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-gray-400">
                    …{(m.id || '').replace(/-/g, '').slice(-10)}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
                      refCount === 0
                        ? 'bg-gray-100 text-gray-500'
                        : mostReferenced
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-gray-100 text-gray-800'
                    }`}
                    title={mostReferenced ? 'Most-referenced in this cluster — natural survivor candidate' : `${refCount} downstream PCS claim instance(s)`}
                  >
                    {mostReferenced && <span aria-hidden="true">★</span>}
                    {refCount}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-700">
                  {m.claimFamily || <span className="text-gray-400">—</span>}
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {m.createdTime ? new Date(m.createdTime).toISOString().slice(0, 10) : '—'}
                </td>
                <td className="px-3 py-2">
                  <InlineEditField
                    entityType="canonical_claim"
                    entityId={m.id}
                    fieldPath="dedupeDecision"
                    value={m.dedupeDecision || ''}
                    variant="select"
                    options={DEDUPE_DECISION_OPTIONS}
                    capability="pcs.canonical:edit"
                    onSaved={onRowUpdated}
                  />
                </td>
                <td className="px-3 py-2">
                  {m.dedupeDecision ? (
                    <span className={`inline-block rounded border px-1.5 py-0.5 text-xs font-medium ${DECISION_BADGE[m.dedupeDecision]?.color || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                      {DECISION_BADGE[m.dedupeDecision]?.label || m.dedupeDecision}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 italic">pending</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <a
                    href={`https://www.notion.so/${(m.id || '').replace(/-/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-pacific-600 hover:underline"
                  >
                    open
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function OrphanClusterCard({ members }) {
  return (
    <section className="rounded-md border border-amber-300 bg-amber-50 p-4">
      <h2 className="text-sm font-semibold text-amber-900">
        Orphan cluster — {members.length} rows missing taxonomy
      </h2>
      <p className="mt-1 text-xs text-amber-900 max-w-2xl">
        These rows all fingerprint to the same degenerate key because their
        prefix / benefit / active-ingredient relations are unset. They are NOT
        semantic duplicates — they need their taxonomy backfilled row-by-row.
        The dedupe decision control is intentionally disabled; use the
        canonical-claim detail page to assign the missing relations.
      </p>
      <div className="mt-3 overflow-hidden rounded border border-amber-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-amber-100/50 text-xs uppercase text-amber-900">
            <tr>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Short ID</th>
              <th className="px-3 py-2 text-left">PCS app link</th>
              <th className="px-3 py-2 text-left">Notion</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-amber-200">
                <td className="px-3 py-2 text-gray-900">
                  {m.canonicalClaim || <em className="text-gray-400">no title</em>}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">
                  …{(m.id || '').replace(/-/g, '').slice(-10)}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/pcs/canonical-claims/${m.id}`}
                    className="text-xs text-pacific-600 hover:underline"
                  >
                    Edit in PCS
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <a
                    href={`https://www.notion.so/${(m.id || '').replace(/-/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-pacific-600 hover:underline"
                  >
                    open
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
