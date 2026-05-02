'use client';

import Link from 'next/link';

/**
 * PcsSupportingDocs — Table 5 (supporting documentation). Wave 4.3.3.
 *
 * Compact table of evidence packets with
 * `substantiationTier === 'Table 5 (supporting doc)'`. Shows citation +
 * relevance note.
 *
 * Props:
 *   evidencePackets — all packets on this version; filtered here.
 */
export default function PcsSupportingDocs({ evidencePackets = [] }) {
  const rows = evidencePackets
    .filter(p => p.substantiationTier === 'Table 5 (supporting doc)')
    .slice()
    .sort((a, b) => {
      const av = a.sortOrder ?? Number.POSITIVE_INFINITY;
      const bv = b.sortOrder ?? Number.POSITIVE_INFINITY;
      return av - bv;
    });

  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">
        No supporting documentation recorded.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Citation
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Relevance note
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {rows.map(p => (
            <tr key={p.id} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-sm text-gray-800 align-top">
                {p.evidenceItemId ? (
                  <Link
                    href={`/pcs/evidence/${p.evidenceItemId}`}
                    className="text-pacific-700 hover:underline"
                  >
                    {p.name || '(untitled packet)'}
                  </Link>
                ) : (
                  p.name || '(untitled packet)'
                )}
              </td>
              <td className="px-4 py-2 text-sm text-gray-700 align-top whitespace-normal">
                {p.relevanceNote || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
