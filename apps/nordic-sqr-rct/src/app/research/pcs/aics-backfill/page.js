'use client';

/**
 * /research/pcs/aics-backfill — AICS-Scoped Claim Review
 *
 * Redesigned backfill review that maps PCS claims to AICS claims (the
 * authoritative ingredient claim library) instead of the generic
 * canonical-claims library.
 *
 * Key differences from the old backfill-review page:
 *   - Identical claim texts grouped together → approve once → all N products
 *   - Right pane shows only AICS claims for THIS ingredient (10-20 vs 94)
 *   - "Unmatched" = potential compliance gap (amber flag), not just a miss
 *   - "No AICS yet" bucket = ingredient AICS still being built (not an error)
 *   - Audit trail: algorithm's proposal + confidence stored alongside decision
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';

const STATUS_OPTIONS = [
  { value: 'pending',          label: 'Ready to review',  color: 'bg-blue-100 text-blue-900 border-blue-300' },
  { value: 'low-confidence',   label: 'Low confidence',   color: 'bg-orange-100 text-orange-900 border-orange-300' },
  { value: 'unmatched',        label: 'Unmatched ⚠',      color: 'bg-amber-100 text-amber-900 border-amber-300' },
  { value: 'no-aics',          label: 'Pending AICS',     color: 'bg-gray-100 text-gray-500 border-gray-300' },
  { value: 'no-ingredient',    label: 'No ingredient',    color: 'bg-gray-100 text-gray-400 border-gray-200' },
];

function ConfidencePill({ value }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-green-100 text-green-800' : pct >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700';
  return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono ${color}`}>{pct}%</span>;
}

function StatusBadge({ status }) {
  const opt = STATUS_OPTIONS.find(o => o.value === status);
  if (!opt) return null;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${opt.color}`}>
      {opt.label}
    </span>
  );
}

/** Left panel: list of claim groups for the selected status + ingredient */
function ClaimGroupList({ groups, selectedKey, onSelect }) {
  if (!groups.length) {
    return <p className="text-sm text-gray-500 px-4 py-6 text-center">No claims in this bucket.</p>;
  }
  return (
    <ul className="divide-y divide-gray-100">
      {groups.map(g => (
        <li key={g.key}>
          <button
            onClick={() => onSelect(g)}
            className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedKey === g.key ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
          >
            <p className="text-sm text-gray-800 line-clamp-2 mb-1">{g.claimText}</p>
            <div className="flex items-center gap-2 flex-wrap">
              {g.ingredientName && (
                <span className="text-xs text-pacific-700 font-medium">{g.ingredientName}</span>
              )}
              {g.aicsDocDemographic && (
                <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded px-1.5">{g.aicsDocDemographic}</span>
              )}
              <span className="text-xs text-gray-400">{g.instances.length} product{g.instances.length !== 1 ? 's' : ''}</span>
              {g.confidence > 0 && <ConfidencePill value={g.confidence} />}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Right panel: AICS claims for the selected group's document */
function AicsClaimsPanel({ group, aicsClaims, loadingClaims, onApprove, onNoMatch, approving }) {
  const [selected, setSelected] = useState(null);

  // Pre-select the algorithm's proposed AICS claim when the group changes
  useEffect(() => {
    setSelected(group?.aicsClaimId || null);
  }, [group?.key]);

  if (!group) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Select a claim on the left to review
      </div>
    );
  }

  if (group.status === 'no-aics') {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600 mb-2">
          No approved AICS document exists for <strong>{group.ingredientName}</strong> yet.
        </p>
        <p className="text-xs text-gray-500">
          This claim will become reviewable once the AICS for this ingredient is uploaded and approved.
        </p>
      </div>
    );
  }

  if (group.status === 'no-ingredient') {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">
          This claim has no formula line with a resolved canonical ingredient.
          Link the ingredient in the Living View first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Selected claim text */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">PCS Claim text</p>
        <p className="text-sm text-gray-800 font-medium">{group.claimText}</p>
        <p className="text-xs text-gray-500 mt-1">
          Appears in <strong>{group.instances.length}</strong> product{group.instances.length !== 1 ? 's' : ''}.
          Approving here confirms the mapping for all of them.
        </p>
      </div>

      {/* AICS claims list */}
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">
          AICS Claims — {group.ingredientName}
          {group.aicsDocDemographic ? ` · ${group.aicsDocDemographic}` : ''}
        </p>

        {loadingClaims ? (
          <p className="text-sm text-gray-400">Loading AICS claims…</p>
        ) : aicsClaims.length === 0 ? (
          <p className="text-sm text-gray-500">No AICS claims found for this document.</p>
        ) : (
          <ul className="space-y-2">
            {aicsClaims.map(claim => {
              const isProposed = claim.id === group.aicsClaimId;
              const isSelected = claim.id === selected;
              return (
                <li key={claim.id}>
                  <button
                    onClick={() => setSelected(claim.id)}
                    className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                      isSelected
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                        isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800">{claim.claimText || claim.claimId}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {claim.grade && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              Grade {claim.grade}
                            </span>
                          )}
                          {claim.minDose != null && (
                            <span className="text-xs text-gray-500">
                              ≥{claim.minDose} {claim.minDoseUnit || ''}
                            </span>
                          )}
                          {claim.benefitCategory && (
                            <span className="text-xs text-gray-500">{claim.benefitCategory}</span>
                          )}
                          {isProposed && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              Algorithm suggestion <ConfidencePill value={group.confidence} />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Action buttons */}
      <div className="p-4 border-t border-gray-200 flex gap-3">
        <button
          disabled={!selected || approving}
          onClick={() => onApprove(group, selected)}
          className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {approving ? 'Saving…' : `Confirm match → ${group.instances.length} product${group.instances.length !== 1 ? 's' : ''}`}
        </button>
        <button
          disabled={approving}
          onClick={() => onNoMatch(group)}
          className="py-2 px-3 border border-amber-300 text-amber-700 rounded-lg text-sm hover:bg-amber-50 disabled:opacity-40 transition-colors"
        >
          No match
        </button>
      </div>
    </div>
  );
}

export default function AicsBackfillPage() {
  const { user } = useAuth();
  const canEdit = hasAnyRole(user, ROLE_SETS.PCS_WRITERS);

  const [groups, setGroups] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('pending');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [aicsClaims, setAicsClaims] = useState([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [approving, setApproving] = useState(false);
  const [toast, setToast] = useState(null);

  // Load claim groups
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pcs/aics-backfill?status=${status}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setGroups(data.groups || []);
      setStats(data.stats || null);
      setSelectedGroup(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  // Fetch AICS claims for the selected group's document
  useEffect(() => {
    if (!selectedGroup?.aicsDocId) {
      setAicsClaims([]);
      return;
    }
    setLoadingClaims(true);
    fetch(`/api/pcs/aics/${selectedGroup.aicsDocId}`)
      .then(r => r.ok ? r.json() : { claims: [] })
      .then(data => {
        // The AICS document detail endpoint returns the doc + its claims
        const claims = data.claims || data.latestVersionClaims || [];
        setAicsClaims(claims);
      })
      .catch(() => setAicsClaims([]))
      .finally(() => setLoadingClaims(false));
  }, [selectedGroup?.aicsDocId]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleApprove = async (group, aicsClaimId) => {
    if (!canEdit || approving) return;
    setApproving(true);
    try {
      const res = await fetch('/api/pcs/aics-backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aicsClaimId,
          pcsClaimIds: group.instances.map(i => i.pcsClaimId),
          confidence: group.confidence,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      showToast(`Confirmed for ${data.updated} product${data.updated !== 1 ? 's' : ''}`);
      // Remove the approved group from the list optimistically
      setGroups(prev => prev.filter(g => g.key !== group.key));
      setSelectedGroup(null);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setApproving(false);
    }
  };

  const handleNoMatch = async (group) => {
    if (!canEdit || approving) return;
    setApproving(true);
    try {
      const res = await fetch('/api/pcs/aics-backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aicsClaimId: null,
          pcsClaimIds: group.instances.map(i => i.pcsClaimId),
          confidence: null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      showToast(`Flagged as unmatched — recorded as compliance gap`);
      setGroups(prev => prev.filter(g => g.key !== group.key));
      setSelectedGroup(null);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setApproving(false);
    }
  };

  // Unique ingredient names for the legend
  const ingredientNames = [...new Set(groups.map(g => g.ingredientName).filter(Boolean))];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">AICS Claim Review</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Map product claims to their AICS ingredient substantiation records
            </p>
          </div>
          <Link href="/research/pcs/aics" className="text-sm text-pacific-600 hover:underline">
            ← AICS Library
          </Link>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="mt-3 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-gray-600">{stats.confirmed} confirmed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-xs text-gray-600">{stats.pending || 0} ready to review</span>
            </div>
            {stats.unmatched > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-xs text-amber-700 font-medium">{stats.unmatched} unmatched (compliance gap)</span>
              </div>
            )}
            {stats['no-aics'] > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-300" />
                <span className="text-xs text-gray-500">{stats['no-aics']} pending AICS</span>
              </div>
            )}
            <span className="text-xs text-gray-400 ml-auto">{stats.total} total claims</span>
          </div>
        )}

        {/* Status filter tabs */}
        <div className="mt-3 flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                status === opt.value ? opt.color : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {opt.label}
              {stats && stats[opt.value] != null && (
                <span className="ml-1 opacity-70">({stats[opt.value] || 0})</span>
              )}
            </button>
          ))}
          <button
            onClick={load}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600 px-2"
          >
            ↺ Refresh
          </button>
        </div>
      </header>

      {/* Main two-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left: claim groups */}
        <div className="w-[380px] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-400">Loading…</div>
          ) : error ? (
            <div className="p-6 text-sm text-red-600">{error}</div>
          ) : (
            <>
              {ingredientNames.length > 0 && (
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs text-gray-500">
                    {ingredientNames.join(' · ')}
                  </p>
                </div>
              )}
              <ClaimGroupList
                groups={groups}
                selectedKey={selectedGroup?.key}
                onSelect={setSelectedGroup}
              />
            </>
          )}
        </div>

        {/* Right: AICS claims panel */}
        <div className="flex-1 min-w-0 bg-white overflow-hidden flex flex-col">
          <AicsClaimsPanel
            group={selectedGroup}
            aicsClaims={aicsClaims}
            loadingClaims={loadingClaims}
            onApprove={handleApprove}
            onNoMatch={handleNoMatch}
            approving={approving}
          />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-lg shadow-lg text-sm font-medium z-50 ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
