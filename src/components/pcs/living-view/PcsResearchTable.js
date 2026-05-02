'use client';

import { useMemo } from 'react';
import Link from 'next/link';

/**
 * PcsResearchTable — Table 4 (primary studies). Wave 4.3.3.
 *
 * Renders one card per evidence packet whose substantiationTier is
 * `'Table 4 (primary study)'` (or whose tier is missing/unexpected — those
 * are defaulted here to Table 4 with a console.warn).
 *
 * Plan §3 / §11 Q10: flat list sorted by `sortOrder`. Grouping by claim
 * deferred to a later iteration.
 *
 * Props:
 *   evidencePackets  — all packets on this version (filtered + defaulted here)
 *   doc              — document payload (for console.warn context)
 *   version          — latest version payload
 *   onRequestReview  — (packet) => void; opens BackfillSideSheet pre-filled
 *                      with `requestType='low-confidence'` and
 *                      `specificField='evidencePacket.{packetId}'`.
 */
export default function PcsResearchTable({
  evidencePackets = [],
  doc,
  version,
  onRequestReview,
}) {
  const rows = useMemo(() => {
    const expected = new Set([
      'Table 4 (primary study)',
      'Table 5 (supporting doc)',
      'Table 6 (null result)',
    ]);
    const filtered = [];
    for (const p of evidencePackets) {
      const tier = p.substantiationTier;
      if (tier === 'Table 4 (primary study)') {
        filtered.push(p);
        continue;
      }
      if (!expected.has(tier)) {
        // Unknown / null tier — default to Table 4 and warn.
        if (typeof console !== 'undefined') {
          // eslint-disable-next-line no-console
          console.warn(
            '[PcsResearchTable] packet has unexpected substantiationTier — defaulting to Table 4',
            {
              packetId: p.id,
              receivedTier: tier,
              docId: doc?.id,
              pcsId: doc?.pcsId,
              versionId: version?.id,
            }
          );
        }
        filtered.push(p);
      }
    }
    filtered.sort((a, b) => {
      const av = a.sortOrder ?? Number.POSITIVE_INFINITY;
      const bv = b.sortOrder ?? Number.POSITIVE_INFINITY;
      return av - bv;
    });
    return filtered;
  }, [evidencePackets, doc?.id, doc?.pcsId, version?.id]);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">
        No primary study evidence packets linked to claims in this version.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map(pkt => (
        <ResearchCard
          key={pkt.id}
          packet={pkt}
          onRequestReview={onRequestReview}
        />
      ))}
    </div>
  );
}

function ResearchCard({ packet, onRequestReview }) {
  const citation = packet.name || '(untitled packet)';
  const dose =
    packet.studyDoseAmount != null && packet.studyDoseUnit
      ? `${packet.studyDoseAmount} ${packet.studyDoseUnit}`
      : packet.studyDoseAmount != null
        ? String(packet.studyDoseAmount)
        : packet.studyDoseUnit || null;

  return (
    <article className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-2">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900">
            {packet.evidenceItemId ? (
              <Link
                href={`/pcs/evidence/${packet.evidenceItemId}`}
                className="text-pacific-700 hover:underline"
              >
                {citation}
              </Link>
            ) : (
              citation
            )}
          </h3>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          <TierBadge tier={packet.substantiationTier || 'Table 4 (primary study)'} />
          {packet.meetsSqrThreshold && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border bg-green-50 text-green-700 border-green-200"
              title="Meets SQR-RCT threshold"
            >
              SQR ✓
            </span>
          )}
        </div>
      </header>

      {packet.studyDesignSummary && (
        <p className="text-xs text-gray-600 whitespace-pre-wrap">
          <span className="font-medium text-gray-500">Design: </span>
          {packet.studyDesignSummary}
        </p>
      )}

      {packet.keyTakeaway ? (
        <p className="text-sm text-gray-800 whitespace-pre-wrap">
          <span className="font-medium text-gray-500 text-xs uppercase tracking-wide">
            Key takeaway:{' '}
          </span>
          {packet.keyTakeaway}
        </p>
      ) : (
        <p className="text-xs italic text-amber-700">
          Key takeaway missing — flag for review.
        </p>
      )}

      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600 pt-1">
        {packet.sampleSize != null && (
          <div>
            <dt className="inline font-medium text-gray-500">N: </dt>
            <dd className="inline">{packet.sampleSize}</dd>
          </div>
        )}
        {dose && (
          <div>
            <dt className="inline font-medium text-gray-500">Dose: </dt>
            <dd className="inline">{dose}</dd>
          </div>
        )}
        {packet.evidenceRole && (
          <div>
            <dt className="inline font-medium text-gray-500">Role: </dt>
            <dd className="inline">{packet.evidenceRole}</dd>
          </div>
        )}
      </dl>

      {onRequestReview && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => onRequestReview(packet)}
            className="px-2 py-0.5 text-[11px] font-medium text-pacific-700 border border-pacific-300 rounded hover:bg-pacific-50"
          >
            Flag for review
          </button>
        </div>
      )}
    </article>
  );
}

function TierBadge({ tier }) {
  const short =
    tier === 'Table 4 (primary study)'
      ? 'Table 4'
      : tier === 'Table 5 (supporting doc)'
        ? 'Table 5'
        : tier === 'Table 6 (null result)'
          ? 'Table 6'
          : tier;
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border bg-pacific-50 text-pacific-700 border-pacific-200"
      title={tier}
    >
      {short}
    </span>
  );
}
