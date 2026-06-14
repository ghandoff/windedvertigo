'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import PcsTable from '../PcsTable';
import InlineField from '@/components/pcs/InlineField';
import { CLAIM_BUCKETS, CLAIM_STATUSES } from '@/lib/pcs-config';

/**
 * PcsClaimsSection — Tables 3A / 3B / 3C (Wave 4.3.2).
 *
 * Part 7C — added inline editing to all three bucket tables.
 * Part 8A — "Request deletion" button on 3A rows (sends to admin queue + Slack).
 *
 * Props:
 *   claims          — array of claim rows
 *   canEdit         — true when user has pcs.claims:edit
 *   doc             — document payload
 *   version         — latest version payload
 *   user            — current user (for requestedBy on delete requests)
 *   onRequestReview — (claim) => void; opens BackfillSideSheet
 *   onClaimUpdated  — (updatedClaim) => void; parent replaces claim in state
 *   onClaimAdded    — (newClaim) => void; parent appends new claim to state
 */
export default function PcsClaimsSection({
  claims = [],
  canEdit = false,
  doc,
  version,
  user,
  onRequestReview,
  onClaimUpdated,
  onClaimAdded,
}) {
  const [tab, setTab] = useState('3A');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customClaimOpen, setCustomClaimOpen] = useState(false);

  const bucketed = useMemo(() => {
    const map = { '3A': [], '3B': [], '3C': [] };
    const validBuckets = new Set(CLAIM_BUCKETS);
    for (const c of claims) {
      const bucket = c.claimBucket;
      if (validBuckets.has(bucket)) {
        map[bucket].push(c);
      } else {
        if (typeof console !== 'undefined') {
          // eslint-disable-next-line no-console
          console.warn('[PcsClaimsSection] claim has unexpected bucket — defaulting to 3A', {
            claimId: c.id, claimNo: c.claimNo, receivedBucket: bucket,
            docId: doc?.id, pcsId: doc?.pcsId, versionId: version?.id,
          });
        }
        map['3A'].push(c);
      }
    }
    return map;
  }, [claims, doc?.id, doc?.pcsId, version?.id]);

  const counts = { '3A': bucketed['3A'].length, '3B': bucketed['3B'].length, '3C': bucketed['3C'].length };

  const tabs = [
    { key: '3A', label: 'Table 3A — Primary claims' },
    { key: '3B', label: 'Table 3B — Secondary' },
    { key: '3C', label: 'Table 3C — Supporting' },
  ];

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div role="tablist" aria-label="Claims buckets" className="flex flex-wrap border-b border-gray-200">
        {tabs.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              aria-controls={`claims-panel-${t.key}`}
              id={`claims-tab-${t.key}`}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-pacific-600 text-pacific-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
                active ? 'bg-pacific-100 text-pacific-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`claims-panel-${tab}`} aria-labelledby={`claims-tab-${tab}`}>
        {tab === '3A' && (
          <Bucket3ATable rows={bucketed['3A']} canEdit={canEdit} user={user} onRequestReview={onRequestReview} onClaimUpdated={onClaimUpdated} />
        )}
        {tab === '3B' && (
          <Bucket3BTable rows={bucketed['3B']} canEdit={canEdit} onClaimUpdated={onClaimUpdated} />
        )}
        {tab === '3C' && (
          <Bucket3CTable rows={bucketed['3C']} canEdit={canEdit} onClaimUpdated={onClaimUpdated} />
        )}
      </div>

      {/* Add claim action bar — only for writers */}
      {canEdit && version?.id && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          {!pickerOpen && !customClaimOpen && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="text-xs px-3 py-1.5 rounded-md bg-pacific-600 text-white font-medium hover:bg-pacific-700 transition"
              >
                + Add from AICS
              </button>
              <button
                type="button"
                onClick={() => setCustomClaimOpen(true)}
                className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
              >
                Request custom claim
              </button>
            </div>
          )}

          {pickerOpen && (
            <AicsClaimPicker
              versionId={version.id}
              targetBucket={tab}
              onClose={() => setPickerOpen(false)}
              onAdded={(claim) => { setPickerOpen(false); if (onClaimAdded) onClaimAdded(claim); }}
            />
          )}

          {customClaimOpen && (
            <CustomClaimRequestForm
              versionId={version.id}
              targetBucket={tab}
              user={user}
              onClose={() => setCustomClaimOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Claim status badge ────────────────────────────────────────────────────────

function ClaimStatusBadge({ status }) {
  if (!status) return <span className="text-gray-400">—</span>;
  const styles =
    status === 'Authorized' ? 'bg-green-50 text-green-700 border-green-200'
    : status === 'Proposed' ? 'bg-blue-50 text-blue-700 border-blue-200'
    : status === 'Not approved' ? 'bg-red-50 text-red-700 border-red-200'
    : status === 'Unknown' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-gray-50 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded border ${styles}`}>
      {status}
    </span>
  );
}

// ── Shared row component ──────────────────────────────────────────────────────

function ClaimRow({ claim, canEdit, onClaimUpdated, children }) {
  const [local, setLocal] = useState(claim);

  function makeSaveFn(fieldPath) {
    return async (value) => {
      const res = await fetch(`/api/pcs/claims/${local.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldPath]: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setLocal(json);
      if (onClaimUpdated) onClaimUpdated(json);
      return json;
    };
  }

  return children({ local, makeSaveFn, canEdit });
}

// ── Table 3A ──────────────────────────────────────────────────────────────────

function Bucket3ATable({ rows, canEdit, user, onRequestReview, onClaimUpdated }) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-gray-400 italic">No primary claims on this version yet.</p>;
  }

  return (
    <div className="space-y-2">
      {canEdit && (
        <p className="text-xs text-gray-400 italic">Click any cell to edit in place.</p>
      )}

      {/* Mobile — card list (one card per claim). The 7-column 3A table
          can't usefully horizontal-scroll on a 375px viewport; cards let
          users see every field for one claim at a time with vertical flow. */}
      <div className="md:hidden space-y-3">
        {rows.map((claim) => (
          <ClaimRow key={claim.id} claim={claim} canEdit={canEdit} onClaimUpdated={onClaimUpdated}>
            {({ local, makeSaveFn }) => (
              <article className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <header className="flex items-baseline justify-between gap-2 mb-1">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Claim #</div>
                  <InlineField
                    value={local.claimNo ?? ''}
                    onSave={makeSaveFn('claimNo')}
                    canEdit={canEdit}
                    fieldName="claim number"
                    variant="number"
                    displayClassName="text-sm font-semibold text-gray-900"
                    emptyLabel="—"
                  />
                </header>
                <div className="mt-1">
                  <InlineField
                    value={local.claim || ''}
                    onSave={makeSaveFn('claim')}
                    canEdit={canEdit}
                    fieldName="claim text"
                    variant="textarea"
                    rows={3}
                    displayClassName="text-sm text-gray-800"
                  />
                  <AicsBadge claim={local} />
                </div>
                <dl className="mt-2 divide-y divide-gray-100">
                  <ClaimFieldRow label="Status">
                    <InlineField
                      value={local.claimStatus || ''}
                      onSave={makeSaveFn('claimStatus')}
                      canEdit={canEdit}
                      fieldName="claim status"
                      variant="select"
                      options={CLAIM_STATUSES}
                      emptyLabel={<ClaimStatusBadge status={null} />}
                      displayClassName=""
                    />
                  </ClaimFieldRow>
                  <ClaimFieldRow label="Bucket">
                    <InlineField
                      value={local.claimBucket || ''}
                      onSave={makeSaveFn('claimBucket')}
                      canEdit={canEdit}
                      fieldName="claim bucket"
                      variant="select"
                      options={CLAIM_BUCKETS}
                      displayClassName="text-sm text-gray-700"
                      emptyLabel="3A"
                    />
                  </ClaimFieldRow>
                  <ClaimFieldRow label="Min dose (mg)">
                    <InlineField
                      value={local.minDoseMg ?? ''}
                      onSave={makeSaveFn('minDoseMg')}
                      canEdit={canEdit}
                      fieldName="min dose"
                      variant="number"
                      displayClassName="text-sm font-mono text-gray-900"
                      emptyLabel="—"
                    />
                  </ClaimFieldRow>
                  <ClaimFieldRow label="Max dose (mg)">
                    <InlineField
                      value={local.maxDoseMg ?? ''}
                      onSave={makeSaveFn('maxDoseMg')}
                      canEdit={canEdit}
                      fieldName="max dose"
                      variant="number"
                      displayClassName="text-sm font-mono text-gray-900"
                      emptyLabel="—"
                    />
                  </ClaimFieldRow>
                  <ClaimFieldRow label="Disclaimer">
                    <InlineField
                      value={local.disclaimerRequired ?? false}
                      onSave={makeSaveFn('disclaimerRequired')}
                      canEdit={canEdit}
                      fieldName="disclaimer required"
                      variant="checkbox"
                    />
                  </ClaimFieldRow>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onRequestReview?.(local)}
                    className="px-3 py-1.5 text-xs font-medium text-pacific-700 border border-pacific-300 rounded hover:bg-pacific-50"
                  >
                    Request review
                  </button>
                  {canEdit && <ClaimDeleteButton claim={local} user={user} />}
                </div>
              </article>
            )}
          </ClaimRow>
        ))}
      </div>

      {/* Desktop / tablet — classic table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>Claim #</Th>
              <Th className="min-w-[300px]">Claim</Th>
              <Th>Status</Th>
              <Th>Bucket</Th>
              <Th>Min dose (mg)</Th>
              <Th>Max dose (mg)</Th>
              <Th>Disclaimer</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(claim => (
              <ClaimRow key={claim.id} claim={claim} canEdit={canEdit} onClaimUpdated={onClaimUpdated}>
                {({ local, makeSaveFn }) => (
                  <tr className="hover:bg-gray-50/50">
                    <Td className="w-16">
                      <InlineField
                        value={local.claimNo ?? ''}
                        onSave={makeSaveFn('claimNo')}
                        canEdit={canEdit}
                        fieldName="claim number"
                        variant="number"
                        displayClassName="text-sm font-medium text-gray-900"
                        emptyLabel="—"
                      />
                    </Td>
                    <Td className="max-w-sm whitespace-normal">
                      <InlineField
                        value={local.claim || ''}
                        onSave={makeSaveFn('claim')}
                        canEdit={canEdit}
                        fieldName="claim text"
                        variant="textarea"
                        rows={2}
                        displayClassName="text-sm text-gray-800"
                      />
                      <AicsBadge claim={local} />
                    </Td>
                    <Td>
                      <InlineField
                        value={local.claimStatus || ''}
                        onSave={makeSaveFn('claimStatus')}
                        canEdit={canEdit}
                        fieldName="claim status"
                        variant="select"
                        options={CLAIM_STATUSES}
                        emptyLabel={<ClaimStatusBadge status={null} />}
                        displayClassName=""
                      />
                      {local.claimStatus && !canEdit && <ClaimStatusBadge status={local.claimStatus} />}
                    </Td>
                    <Td>
                      <InlineField
                        value={local.claimBucket || ''}
                        onSave={makeSaveFn('claimBucket')}
                        canEdit={canEdit}
                        fieldName="claim bucket"
                        variant="select"
                        options={CLAIM_BUCKETS}
                        displayClassName="text-sm text-gray-700"
                        emptyLabel="3A"
                      />
                    </Td>
                    <Td>
                      <InlineField
                        value={local.minDoseMg ?? ''}
                        onSave={makeSaveFn('minDoseMg')}
                        canEdit={canEdit}
                        fieldName="min dose"
                        variant="number"
                        displayClassName="text-sm font-mono text-gray-900"
                        emptyLabel="—"
                      />
                    </Td>
                    <Td>
                      <InlineField
                        value={local.maxDoseMg ?? ''}
                        onSave={makeSaveFn('maxDoseMg')}
                        canEdit={canEdit}
                        fieldName="max dose"
                        variant="number"
                        displayClassName="text-sm font-mono text-gray-900"
                        emptyLabel="—"
                      />
                    </Td>
                    <Td>
                      <InlineField
                        value={local.disclaimerRequired ?? false}
                        onSave={makeSaveFn('disclaimerRequired')}
                        canEdit={canEdit}
                        fieldName="disclaimer required"
                        variant="checkbox"
                      />
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => onRequestReview?.(local)}
                          className="px-2 py-0.5 text-[11px] font-medium text-pacific-700 border border-pacific-300 rounded hover:bg-pacific-50"
                        >
                          Request review
                        </button>
                        {canEdit && (
                          <ClaimDeleteButton claim={local} user={user} />
                        )}
                      </div>
                    </Td>
                  </tr>
                )}
              </ClaimRow>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Table 3B ──────────────────────────────────────────────────────────────────

function Bucket3BTable({ rows, canEdit, onClaimUpdated }) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-gray-400 italic">No Table 3B (secondary) claims on this version.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-amber-200">
      <table className="min-w-full divide-y divide-amber-100 text-sm">
        <thead className="bg-amber-50">
          <tr>
            <Th className="text-amber-800">Claim #</Th>
            <Th className="text-amber-800 min-w-[300px]">Claim</Th>
            <Th className="text-amber-800">Status</Th>
            <Th className="text-amber-800">Notes</Th>
          </tr>
        </thead>
        <tbody className="bg-amber-50/30 divide-y divide-amber-100">
          {rows.map(claim => (
            <ClaimRow key={claim.id} claim={claim} canEdit={canEdit} onClaimUpdated={onClaimUpdated}>
              {({ local, makeSaveFn }) => (
                <tr className="hover:bg-amber-50">
                  <Td>
                    <InlineField value={local.claimNo ?? ''} onSave={makeSaveFn('claimNo')} canEdit={canEdit} fieldName="claim number" variant="number" displayClassName="text-sm text-gray-800" emptyLabel="—" />
                  </Td>
                  <Td className="whitespace-normal">
                    <InlineField value={local.claim || ''} onSave={makeSaveFn('claim')} canEdit={canEdit} fieldName="claim text" variant="textarea" rows={2} displayClassName="text-sm text-gray-800" />
                    <AicsBadge claim={local} />
                  </Td>
                  <Td>
                    <InlineField value={local.claimStatus || ''} onSave={makeSaveFn('claimStatus')} canEdit={canEdit} fieldName="claim status" variant="select" options={CLAIM_STATUSES} displayClassName="text-sm text-gray-700" emptyLabel="—" />
                  </Td>
                  <Td className="whitespace-normal">
                    <InlineField value={local.claimNotes || ''} onSave={makeSaveFn('claimNotes')} canEdit={canEdit} fieldName="notes" variant="textarea" rows={2} displayClassName="text-sm text-gray-600" />
                  </Td>
                </tr>
              )}
            </ClaimRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Table 3C ──────────────────────────────────────────────────────────────────

function Bucket3CTable({ rows, canEdit, onClaimUpdated }) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-gray-400 italic">No Table 3C (supporting) claims on this version.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-100 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <Th>Claim #</Th>
            <Th className="min-w-[300px]">Claim</Th>
            <Th>Min dose (mg)</Th>
            <Th>Max dose (mg)</Th>
          </tr>
        </thead>
        <tbody className="bg-gray-50/30 divide-y divide-gray-100 text-gray-500">
          {rows.map(claim => (
            <ClaimRow key={claim.id} claim={claim} canEdit={canEdit} onClaimUpdated={onClaimUpdated}>
              {({ local, makeSaveFn }) => (
                <tr className="hover:bg-gray-50">
                  <Td>
                    <InlineField value={local.claimNo ?? ''} onSave={makeSaveFn('claimNo')} canEdit={canEdit} fieldName="claim number" variant="number" displayClassName="text-sm text-gray-700" emptyLabel="—" />
                  </Td>
                  <Td className="whitespace-normal">
                    <InlineField value={local.claim || ''} onSave={makeSaveFn('claim')} canEdit={canEdit} fieldName="claim text" variant="textarea" rows={2} displayClassName="text-sm text-gray-700" />
                    <AicsBadge claim={local} />
                  </Td>
                  <Td>
                    <InlineField value={local.minDoseMg ?? ''} onSave={makeSaveFn('minDoseMg')} canEdit={canEdit} fieldName="min dose" variant="number" displayClassName="text-sm font-mono" emptyLabel="—" />
                  </Td>
                  <Td>
                    <InlineField value={local.maxDoseMg ?? ''} onSave={makeSaveFn('maxDoseMg')} canEdit={canEdit} fieldName="max dose" variant="number" displayClassName="text-sm font-mono" emptyLabel="—" />
                  </Td>
                </tr>
              )}
            </ClaimRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── AICS provenance badge ─────────────────────────────────────────────────────
// Shows whether a claim is tied to an AICS canonical claim (green) or still
// floating with no confirmed mapping (amber). 'NO_MATCH' means a reviewer
// explicitly confirmed there is no corresponding AICS claim (red — compliance gap).

function AicsBadge({ claim }) {
  if (!claim) return null;
  const src = claim.sourceAicsClaimId;
  const matched = claim.matchedAicsClaimId;

  if (src) {
    return (
      <span title="Propagated directly from an approved AICS claim" className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
        ✓ from AICS
      </span>
    );
  }
  if (matched && matched !== 'NO_MATCH') {
    return (
      <span title="Manually confirmed match to an AICS claim" className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
        ✓ AICS matched
      </span>
    );
  }
  if (matched === 'NO_MATCH') {
    return (
      <span title="Reviewer confirmed: no matching AICS claim exists — compliance gap" className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
        ✗ no AICS claim
      </span>
    );
  }
  return (
    <span title="Not yet mapped to an AICS claim — review in Claim Backfill" className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
      ◑ unmatched
    </span>
  );
}

// ── Table helpers ─────────────────────────────────────────────────────────────

function Th({ children, className = '' }) {
  return (
    <th className={`px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = '' }) {
  return (
    <td className={`px-4 py-2 align-top ${className}`}>{children}</td>
  );
}

// Card-list field row used by the mobile claim cards (Bucket 3A).
function ClaimFieldRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <dt className="text-xs uppercase tracking-wide text-gray-500 shrink-0 min-w-[90px]">{label}</dt>
      <dd className="min-w-0 flex-1 text-right">{children}</dd>
    </div>
  );
}

// ── Claim delete request button ───────────────────────────────────────────────

function ClaimDeleteButton({ claim, user }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (submitted) {
    return <span className="text-[11px] text-amber-700">Delete requested ✓</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-2 py-0.5 text-[11px] font-medium text-red-600 border border-red-200 rounded hover:bg-red-50"
      >
        Request deletion
      </button>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason.trim()) { setError('Reason required.'); return; }
    setSubmitting(true);
    setError('');
    const claimLabel = claim.claimNo ? `Claim #${claim.claimNo}` : (claim.claim?.slice(0, 60) || claim.id.slice(0, 8));
    try {
      const res = await fetch('/api/pcs/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request: `Delete request: Claim — ${claimLabel}`,
          requestType: 'Delete',
          requestNotes: reason.trim(),
          specificField: `/research/pcs/claims/${claim.id}`,
          resourceType: 'Claim',
          resourceName: claimLabel,
          requestedBy: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.alias || 'unknown',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1 mt-1 p-2 bg-red-50 border border-red-200 rounded text-xs">
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Reason…"
        rows={2}
        className="w-full text-xs border border-gray-300 rounded px-2 py-1"
      />
      {error && <p className="text-red-600">{error}</p>}
      <div className="flex gap-1">
        <button type="submit" disabled={submitting} className="px-2 py-0.5 bg-red-600 text-white rounded text-[11px] disabled:opacity-50">
          {submitting ? '…' : 'Send'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setReason(''); setError(''); }} className="text-gray-500 hover:underline text-[11px]">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── AICS Claim Picker ─────────────────────────────────────────────────────────
//
// Fetches approved AICS claims for this product's ingredients and lets the
// researcher pick one to add directly to this version's claims table.

function AicsClaimPicker({ versionId, targetBucket, onClose, onAdded }) {
  const [groups, setGroups] = useState(null); // null = loading
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(null); // claimId being added
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/pcs/aics/claims-for-product?versionId=${encodeURIComponent(versionId)}`)
      .then(r => r.ok ? r.json() : [])
      .then(setGroups)
      .catch(() => setGroups([]));
  }, [versionId]);

  const filterLower = filter.toLowerCase();
  const filtered = groups
    ? groups.map(g => ({
        ...g,
        claims: g.claims.filter(c =>
          !filter ||
          (c.claimText || '').toLowerCase().includes(filterLower) ||
          g.ingredientName.toLowerCase().includes(filterLower)
        ),
      })).filter(g => g.claims.length > 0)
    : [];

  async function addClaim(group, claim) {
    setSaving(claim.id);
    setError(null);
    try {
      const res = await fetch('/api/pcs/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim: claim.claimText,
          pcsVersionId: versionId,
          claimBucket: targetBucket,
          sourceAicsClaimId: claim.id,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      onAdded(json);
    } catch (e) {
      setError(e.message);
      setSaving(null);
    }
  }

  return (
    <div className="rounded-lg border border-pacific-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-pacific-50 border-b border-pacific-200">
        <span className="text-xs font-semibold text-pacific-800">
          Add from AICS — {targetBucket} claims
        </span>
        <button type="button" onClick={onClose} className="text-xs text-pacific-600 hover:text-pacific-800">
          Cancel
        </button>
      </div>

      {groups === null ? (
        <p className="text-xs text-gray-400 px-4 py-3">Loading AICS claims…</p>
      ) : groups.length === 0 ? (
        <div className="px-4 py-3 space-y-1">
          <p className="text-xs text-gray-500">No approved AICS claims found for this product&apos;s ingredients.</p>
          <p className="text-xs text-gray-400">
            Ensure this version has formula lines with ingredient names that match AICS documents,
            and that those AICS documents are in &quot;Approved&quot; status.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
          {/* Search filter */}
          <div className="px-3 py-2 bg-gray-50">
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter by ingredient or claim text…"
              className="w-full text-xs rounded border border-gray-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-pacific-300"
            />
          </div>

          {filtered.length === 0 && filter ? (
            <p className="text-xs text-gray-400 px-4 py-3 italic">No matches for &ldquo;{filter}&rdquo;</p>
          ) : filtered.map(group => (
            <div key={`${group.aicsDocId}-${group.ingredientName}`} className="px-3 py-2 space-y-1">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                {group.ingredientName}
                <span className="ml-1.5 font-mono text-gray-400">{group.aicsDocAicsId}</span>
              </p>
              {group.claims.map(claim => (
                <div key={claim.id} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 leading-snug">{claim.claimText}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {[
                        claim.minDose ? `≥${claim.minDose}${claim.minDoseUnit || ''}` : null,
                        claim.ageGroup,
                        claim.grade ? `Grade ${claim.grade}` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addClaim(group, claim)}
                    disabled={saving === claim.id}
                    className="flex-shrink-0 text-[11px] px-2 py-0.5 rounded bg-pacific-100 text-pacific-700 hover:bg-pacific-200 disabled:opacity-50 transition font-medium"
                  >
                    {saving === claim.id ? '…' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="text-xs text-red-600 px-4 py-2 border-t border-red-100 bg-red-50">{error}</p>
      )}
    </div>
  );
}

// ── Custom Claim Request Form ─────────────────────────────────────────────────
//
// Lets researchers propose a new claim that isn't in the AICS library yet.
// Posts to /api/pcs/requests (not /api/pcs/claims) — the claim is NOT added
// immediately; it goes through RA review first.

function CustomClaimRequestForm({ versionId, targetBucket, user, onClose }) {
  const [claimText, setClaimText] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!claimText.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/pcs/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request: claimText.trim(),
          requestType: 'Claim',
          requestNotes: reason.trim() || null,
          specificField: `/api/pcs/claims (versionId: ${versionId}, bucket: ${targetBucket})`,
          requestedBy: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.alias || 'unknown',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitted(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 space-y-2">
        <p className="text-xs font-medium text-green-800">
          Custom claim request submitted. An RA will review and add the claim if approved.
        </p>
        <p className="text-xs text-green-700 italic">&ldquo;{claimText}&rdquo;</p>
        <button type="button" onClick={onClose} className="text-xs text-green-600 hover:underline">
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">Request custom claim</p>
        <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">
          Cancel
        </button>
      </div>
      <textarea
        autoFocus
        value={claimText}
        onChange={e => setClaimText(e.target.value)}
        placeholder="Proposed claim text (required)"
        rows={2}
        className="w-full text-xs rounded border border-gray-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-pacific-300"
      />
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Reason / context (optional)"
        rows={1}
        className="w-full text-xs rounded border border-gray-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-pacific-300"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-[10px] text-gray-400">
        This claim will NOT be added immediately — it goes to the RA queue for approval.
      </p>
      <button
        type="submit"
        disabled={submitting || !claimText.trim()}
        className="text-xs px-3 py-1 rounded bg-pacific-600 text-white font-medium hover:bg-pacific-700 disabled:opacity-50 transition"
      >
        {submitting ? 'Submitting…' : 'Submit request'}
      </button>
    </form>
  );
}
