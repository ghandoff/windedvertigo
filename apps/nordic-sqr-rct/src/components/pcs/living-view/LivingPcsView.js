'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';
import LegacyBanner from './LegacyBanner';
import SectionAnchor from './SectionAnchor';
import PcsCoverSection from './PcsCoverSection';
import PcsApplicableProducts from './PcsApplicableProducts';
import PcsRevisionTable from './PcsRevisionTable';
import PcsProductDetails from './PcsProductDetails';
import PcsComposition from './PcsComposition';
import PcsClaimsSection from './PcsClaimsSection';
import PcsResearchTable from './PcsResearchTable';
import PcsSupportingDocs from './PcsSupportingDocs';
import PcsNullResults from './PcsNullResults';
import PcsReferences from './PcsReferences';
import BackfillBadge from './BackfillBadge';
import BackfillSideSheet from './BackfillSideSheet';
import PdfExportButton from './PdfExportButton';
import DraftLabelCopyPanel from './DraftLabelCopyPanel';
import VersionPickerDropdown from './VersionPickerDropdown';

/**
 * LivingPcsView — root client component for the Living PCS View (Wave 4.3).
 *
 * Phase 4.3.0 shipped: header + LegacyBanner + Cover + Table B.
 * Phase 4.3.1 (this): Tables A, 1, 2 + BackfillBadge + BackfillSideSheet.
 *
 * Later phases populate Tables 3A/3B/3C, 4, 5, 6, and References.
 */
const SECTION_LABELS = {
  tableA: 'Revision History',
  tableB: 'Applicable Products',
  table1: 'Product Details',
  table2: 'Product Composition',
  table3: 'Claims (3A / 3B / 3C)',
  table3A: 'Table 3A — Primary claims',
  table3B: 'Table 3B — Secondary claims',
  table3C: 'Table 3C — Supporting claims',
  table4: 'Table 4 — Research Summary',
  table5: 'Table 5 — Supporting Documentation',
  table6: 'Table 6 — Null Results',
  references: 'References',
};

export default function LivingPcsView({ viewPayload, onEdited }) {
  const { user } = useAuth();
  // Client check is UX hint; server is the source of truth (authenticatePcsWrite).
  const canWrite = hasAnyRole(user, ROLE_SETS.PCS_WRITERS);
  const [sheetDraft, setSheetDraft] = useState(null);
  // Wave 5.5 — AI-assisted label copy drafter side panel.
  const [draftCopyOpen, setDraftCopyOpen] = useState(false);
  // Allow sectionHealth to be locally overridden after a request is created
  // (optimistic clear until a refetch replaces it).
  const [healthOverrides, setHealthOverrides] = useState({});

  const openBackfillSheet = useCallback((sectionKey, variant) => {
    setSheetDraft({
      sectionKey,
      sectionLabel: SECTION_LABELS[sectionKey] || sectionKey,
      variant,
    });
  }, []);

  const closeSheet = useCallback(() => setSheetDraft(null), []);

  const onCreated = useCallback(() => {
    if (!sheetDraft?.sectionKey) return;
    setHealthOverrides(prev => ({ ...prev, [sheetDraft.sectionKey]: null }));
  }, [sheetDraft]);

  if (!viewPayload?.document) {
    return <p className="text-red-600">Document not found</p>;
  }

  const {
    document: doc,
    version,
    sectionHealth = {},
    revisionEvents = [],
    formulaLines = [],
    claims = [],
    evidencePackets = [],
    references = [],
    labels = [],
  } = viewPayload;

  // 3A-approved claims the copy drafter can use.
  const claims3A = (claims || []).filter(c => {
    if (c.claimBucket !== '3A') return false;
    const s = (c.claimStatus || '').toLowerCase();
    return s === '' || s === 'approved';
  });
  const canDraftCopy = labels.length > 0 && claims3A.length > 0;

  const effectiveHealth = { ...sectionHealth, ...healthOverrides };

  // Claims section aggregate badge — use the most severe variant across the
  // three buckets so the section header still surfaces one actionable signal.
  const claimsAggregateVariant = (() => {
    const order = { critical: 3, warning: 2, info: 1 };
    const variants = ['table3A', 'table3B', 'table3C']
      .map(k => effectiveHealth[k])
      .filter(Boolean);
    if (variants.length === 0) return null;
    return variants.reduce(
      (acc, v) => ((order[v] || 0) > (order[acc] || 0) ? v : acc),
      variants[0]
    );
  })();

  const openClaimReviewSheet = useCallback(
    claim => {
      const claimNo = claim?.claimNo || 'unlabeled';
      setSheetDraft({
        sectionKey: 'table3A',
        sectionLabel: `Table 3A — Claim ${claimNo}`,
        variant: 'info',
        title: `Review claim ${claimNo}${doc?.pcsId ? ` on ${doc.pcsId}` : ''}`,
        notes: [
          `Claim #: ${claimNo}`,
          `Claim text: ${claim?.claim || '(empty)'}`,
          `Current status: ${claim?.claimStatus || '(unset)'}`,
          `PCS: ${doc?.pcsId || '(no id)'}${version?.version ? ` · v${version.version}` : ''}`,
          '',
          'Requested review / follow-up:',
          '-',
        ].join('\n'),
        relatedClaimIds: claim?.id ? [claim.id] : [],
        specificField: `claim.${claimNo}`,
        requestType: 'low-confidence',
      });
    },
    [doc, version]
  );

  const openPacketReviewSheet = useCallback(
    packet => {
      const citation = packet?.name || '(untitled packet)';
      setSheetDraft({
        sectionKey: 'table4',
        sectionLabel: `Table 4 — ${citation}`,
        variant: 'info',
        title: `Review evidence packet: ${citation}${doc?.pcsId ? ` on ${doc.pcsId}` : ''}`,
        notes: [
          `Evidence packet: ${citation}`,
          `Substantiation tier: ${packet?.substantiationTier || '(unset)'}`,
          `Key takeaway: ${packet?.keyTakeaway || '(empty)'}`,
          `Meets SQR threshold: ${packet?.meetsSqrThreshold ? 'yes' : 'no'}`,
          `PCS: ${doc?.pcsId || '(no id)'}${version?.version ? ` · v${version.version}` : ''}`,
          '',
          'Requested review / follow-up:',
          '-',
        ].join('\n'),
        specificField: packet?.id ? `evidencePacket.${packet.id}` : 'evidencePacket',
        requestType: 'low-confidence',
      });
    },
    [doc, version]
  );

  const badgeFor = (sectionKey) => {
    const variant = effectiveHealth[sectionKey];
    if (!variant) return null;
    return (
      <BackfillBadge
        variant={variant}
        onClick={() => openBackfillSheet(sectionKey, variant)}
      />
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Sticky page header */}
      <header className="sticky top-0 z-10 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-3 bg-gray-50/90 backdrop-blur border-b border-gray-200">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/pcs/documents"
              className="text-xs text-pacific-600 hover:underline"
            >
              ← All documents
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-gray-900 truncate">
                {doc.pcsId}
              </h1>
              {(doc.finishedGoodName || version?.productName) && (
                <span className="text-sm text-gray-600 truncate">
                  {doc.finishedGoodName || version?.productName}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {version && (
              <VersionPickerDropdown
                documentId={doc.id}
                currentVersion={version.version}
                latestVersionId={doc.latestVersionId}
              />
            )}
            {/* Wave 5 interop hook — Labels slot renders null in Wave 4.3. */}
            <PdfExportButton doc={doc} />
            {canDraftCopy && (
              <button
                type="button"
                onClick={() => setDraftCopyOpen(true)}
                className="px-3 py-1.5 text-xs font-medium text-white bg-pacific-600 border border-pacific-600 rounded-md hover:bg-pacific-700 transition-colors whitespace-nowrap"
                title={`Draft label copy for ${labels.length} backing label${labels.length === 1 ? '' : 's'}`}
              >
                Draft label copy
              </button>
            )}
            <Link
              href={`/pcs/documents/${doc.id}`}
              className="px-3 py-1.5 text-xs font-medium text-pacific-600 border border-pacific-600 rounded-md hover:bg-pacific-50 transition-colors whitespace-nowrap"
            >
              Edit metadata
            </Link>
          </div>
        </div>
      </header>

      <LegacyBanner doc={doc} />

      <SectionAnchor id="cover" eyebrow="Section" title="Cover">
        <PcsCoverSection doc={doc} version={version} />
      </SectionAnchor>

      <SectionAnchor
        id="table-a"
        eyebrow="Table A"
        title="Revision History"
        badge={badgeFor('tableA')}
      >
        <PcsRevisionTable revisionEvents={revisionEvents} />
      </SectionAnchor>

      <SectionAnchor
        id="table-b"
        eyebrow="Table B"
        title="Applicable Products"
        badge={badgeFor('tableB')}
      >
        <PcsApplicableProducts doc={doc} />
      </SectionAnchor>

      <SectionAnchor
        id="table-1"
        eyebrow="Table 1"
        title="Product Details"
        badge={badgeFor('table1')}
      >
        <PcsProductDetails
          version={version}
          doc={doc}
          canWrite={canWrite}
          onEdited={onEdited}
        />
      </SectionAnchor>

      <SectionAnchor
        id="table-2"
        eyebrow="Table 2"
        title="Product Composition"
        badge={badgeFor('table2')}
      >
        <PcsComposition formulaLines={formulaLines} />
      </SectionAnchor>

      <SectionAnchor
        id="table-3"
        eyebrow="Table 3"
        title="Claims"
        badge={
          claimsAggregateVariant ? (
            <BackfillBadge
              variant={claimsAggregateVariant}
              onClick={() => {
                // Route to the most-severe bucket's section key so the draft
                // notes reflect the correct sub-table.
                const key =
                  effectiveHealth.table3A === claimsAggregateVariant
                    ? 'table3A'
                    : effectiveHealth.table3B === claimsAggregateVariant
                      ? 'table3B'
                      : 'table3C';
                openBackfillSheet(key, claimsAggregateVariant);
              }}
            />
          ) : null
        }
      >
        <PcsClaimsSection
          claims={claims}
          doc={doc}
          version={version}
          onRequestReview={openClaimReviewSheet}
        />
      </SectionAnchor>

      <SectionAnchor
        id="table-4"
        eyebrow="Table 4"
        title="Research Summary"
        badge={badgeFor('table4')}
      >
        <PcsResearchTable
          evidencePackets={evidencePackets}
          doc={doc}
          version={version}
          onRequestReview={openPacketReviewSheet}
        />
      </SectionAnchor>

      <SectionAnchor
        id="table-5"
        eyebrow="Table 5"
        title="Supporting Documentation"
        badge={badgeFor('table5')}
      >
        <PcsSupportingDocs evidencePackets={evidencePackets} />
      </SectionAnchor>

      <SectionAnchor
        id="table-6"
        eyebrow="Table 6"
        title="Null Results"
        badge={badgeFor('table6')}
      >
        <PcsNullResults evidencePackets={evidencePackets} />
      </SectionAnchor>

      <SectionAnchor
        id="references"
        eyebrow="Section"
        title="References"
        badge={badgeFor('references')}
      >
        <PcsReferences references={references} />
      </SectionAnchor>

      <BackfillSideSheet
        open={Boolean(sheetDraft)}
        onClose={closeSheet}
        onCreated={onCreated}
        draft={sheetDraft}
        doc={doc}
        version={version}
      />

      <DraftLabelCopyPanel
        open={draftCopyOpen}
        onClose={() => setDraftCopyOpen(false)}
        doc={doc}
        labels={labels}
        claims3A={claims3A}
      />
    </div>
  );
}
