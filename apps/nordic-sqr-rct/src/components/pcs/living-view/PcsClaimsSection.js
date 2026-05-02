'use client';

import { useMemo, useState } from 'react';
import PcsTable from '../PcsTable';
import { CLAIM_BUCKETS } from '@/lib/pcs-config';

/**
 * PcsClaimsSection — Tables 3A / 3B / 3C (Wave 4.3.2).
 *
 * Tabbed view over the claims attached to the latest PCS version. Buckets
 * follow `CLAIM_BUCKETS` in pcs-config. Claims with a null or unexpected
 * bucket value are defaulted into 3A (safest — guarantees the substantiation
 * flow still sees them) and a console.warn is emitted with doc/version ids
 * so partial migrations surface during QA.
 *
 * Props:
 *   claims         — array of claim rows (see pcs-claims.js parsePage)
 *   sectionHealth  — { table3A, table3B, table3C } health map from the API
 *   doc            — document payload (forwarded to BackfillSideSheet)
 *   version        — latest version payload
 *   onRequestReview — (claim) => void; opens BackfillSideSheet with a
 *                     claim-specific draft
 */
export default function PcsClaimsSection({
  claims = [],
  doc,
  version,
  onRequestReview,
}) {
  const [tab, setTab] = useState('3A');

  // Bucket claims; fall back to 3A for null/unexpected values and warn.
  const bucketed = useMemo(() => {
    const map = { '3A': [], '3B': [], '3C': [] };
    const validBuckets = new Set(CLAIM_BUCKETS);
    for (const c of claims) {
      const bucket = c.claimBucket;
      if (validBuckets.has(bucket)) {
        map[bucket].push(c);
      } else {
        // Defensive: partially-migrated PCS docs may have null/unknown bucket.
        // Surface to QA via console.warn but keep the row visible under 3A.
        if (typeof console !== 'undefined') {
          // eslint-disable-next-line no-console
          console.warn(
            '[PcsClaimsSection] claim has unexpected bucket — defaulting to 3A',
            {
              claimId: c.id,
              claimNo: c.claimNo,
              receivedBucket: bucket,
              docId: doc?.id,
              pcsId: doc?.pcsId,
              versionId: version?.id,
            }
          );
        }
        map['3A'].push(c);
      }
    }
    return map;
  }, [claims, doc?.id, doc?.pcsId, version?.id]);

  const counts = {
    '3A': bucketed['3A'].length,
    '3B': bucketed['3B'].length,
    '3C': bucketed['3C'].length,
  };

  const tabs = [
    { key: '3A', label: 'Table 3A — Primary claims' },
    { key: '3B', label: 'Table 3B — Secondary' },
    { key: '3C', label: 'Table 3C — Supporting' },
  ];

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Claims buckets"
        className="flex flex-wrap border-b border-gray-200"
      >
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
              <span
                className={`ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
                  active
                    ? 'bg-pacific-100 text-pacific-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`claims-panel-${tab}`}
        aria-labelledby={`claims-tab-${tab}`}
      >
        {tab === '3A' && (
          <Bucket3ATable
            rows={bucketed['3A']}
            onRequestReview={onRequestReview}
          />
        )}
        {tab === '3B' && <Bucket3BTable rows={bucketed['3B']} />}
        {tab === '3C' && <Bucket3CTable rows={bucketed['3C']} />}
      </div>
    </div>
  );
}

// --- Claim status badge ------------------------------------------------------

function ClaimStatusBadge({ status }) {
  if (!status) return <span className="text-gray-400">—</span>;
  const styles =
    status === 'Authorized'
      ? 'bg-green-50 text-green-700 border-green-200'
      : status === 'Proposed'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : status === 'Not approved'
          ? 'bg-red-50 text-red-700 border-red-200'
          : status === 'Unknown'
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-gray-50 text-gray-600 border-gray-200';
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded border ${styles}`}
    >
      {status}
    </span>
  );
}

// --- Table 3A ---------------------------------------------------------------

function Bucket3ATable({ rows, onRequestReview }) {
  const columns = [
    { key: 'claimNo', label: 'Claim #', sortable: true },
    {
      key: 'claim',
      label: 'Claim',
      sortable: true,
      render: v => (
        <span className="text-sm text-gray-800 whitespace-normal">
          {v || '—'}
        </span>
      ),
    },
    {
      key: 'claimStatus',
      label: 'Status',
      sortable: true,
      render: v => <ClaimStatusBadge status={v} />,
    },
    {
      key: 'minDoseMg',
      label: 'Min dose (mg)',
      sortable: true,
      render: v => (v ?? '—'),
    },
    {
      key: 'maxDoseMg',
      label: 'Max dose (mg)',
      sortable: true,
      render: v => (v ?? '—'),
    },
    {
      key: 'disclaimerRequired',
      label: 'Disclaimer',
      sortable: true,
      render: v =>
        v ? (
          <span title="Disclaimer required" aria-label="Disclaimer required">
            ⚠️
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: '_actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <button
          type="button"
          onClick={() => onRequestReview?.(row)}
          className="px-2 py-0.5 text-[11px] font-medium text-pacific-700 border border-pacific-300 rounded hover:bg-pacific-50"
        >
          Request review
        </button>
      ),
    },
  ];
  return (
    <PcsTable
      columns={columns}
      data={rows}
      tableKey="claims-3A"
      emptyMessage="No primary claims on this version yet."
    />
  );
}

// --- Table 3B ---------------------------------------------------------------

function Bucket3BTable({ rows }) {
  // Secondary claims — rendered with an amber row-highlight per Wave 4.3 plan.
  if (!rows || rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">
        No Table 3B (secondary) claims on this version.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-amber-200">
      <table className="min-w-full divide-y divide-amber-100">
        <thead className="bg-amber-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">
              Claim #
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">
              Claim
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">
              Notes
            </th>
          </tr>
        </thead>
        <tbody className="bg-amber-50/30 divide-y divide-amber-100">
          {rows.map(r => (
            <tr key={r.id} className="hover:bg-amber-50">
              <td className="px-4 py-2 text-sm text-gray-800">
                {r.claimNo || '—'}
              </td>
              <td className="px-4 py-2 text-sm text-gray-800 whitespace-normal">
                {r.claim || '—'}
              </td>
              <td className="px-4 py-2 text-sm text-gray-600 whitespace-normal">
                {r.claimNotes || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Table 3C ---------------------------------------------------------------

function Bucket3CTable({ rows }) {
  // Supporting / muted claims.
  if (!rows || rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">
        No Table 3C (supporting) claims on this version.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Claim #
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Claim
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Min dose (mg)
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Max dose (mg)
            </th>
          </tr>
        </thead>
        <tbody className="bg-gray-50/30 divide-y divide-gray-100 text-gray-500">
          {rows.map(r => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-sm">{r.claimNo || '—'}</td>
              <td className="px-4 py-2 text-sm whitespace-normal">
                {r.claim || '—'}
              </td>
              <td className="px-4 py-2 text-sm">{r.minDoseMg ?? '—'}</td>
              <td className="px-4 py-2 text-sm">{r.maxDoseMg ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
