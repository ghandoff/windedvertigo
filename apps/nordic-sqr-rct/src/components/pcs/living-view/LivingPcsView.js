'use client';

import { useCallback, useState, useEffect } from 'react';
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
  // Part 7B/7C — local copies of formula lines + claims for optimistic inline edits.
  // Initialized from viewPayload; updated in-place on each successful cell save.
  const [localFormulaLines, setLocalFormulaLines] = useState(null);
  const [localClaims, setLocalClaims] = useState(null);
  // Canonical ingredients list for the formula line picker (fetched once for editors).
  const [allIngredients, setAllIngredients] = useState([]);

  const openBackfillSheet = useCallback((sectionKey, variant) => {
    setSheetDraft({
      sectionKey,
      sectionLabel: SECTION_LABELS[sectionKey] || sectionKey,
      variant,
    });
  }, []);

  const closeSheet = useCallback(() => setSheetDraft(null), []);

  // Sync local copies when viewPayload changes (e.g. parent re-fetches the view).
  useEffect(() => { setLocalFormulaLines(null); }, [viewPayload]);
  useEffect(() => { setLocalClaims(null); }, [viewPayload]);

  // Fetch all canonical ingredients once for editors (powers the AI picker in Table 2).
  useEffect(() => {
    if (!canWrite) return;
    fetch('/api/pcs/ingredients')
      .then(r => r.ok ? r.json() : [])
      .then(data => setAllIngredients(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [canWrite]);

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
    formulaLines: payloadFormulaLines = [],
    claims: payloadClaims = [],
    evidencePackets = [],
    references = [],
    labels = [],
  } = viewPayload;

  // Use local optimistic copies if set, otherwise fall back to the payload arrays.
  const formulaLines = localFormulaLines ?? payloadFormulaLines;
  const claims = localClaims ?? payloadClaims;

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
              href="/research/pcs/documents"
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
              href={`/research/pcs/documents/${doc.id}`}
              className="px-3 py-1.5 text-xs font-medium text-pacific-600 border border-pacific-600 rounded-md hover:bg-pacific-50 transition-colors whitespace-nowrap"
            >
              Edit metadata
            </Link>
          </div>
        </div>
      </header>

      {/* 2026-05-04 — Word-template chrome. Mirrors the printed PCS .docx
          layout so the Nordic team has visual continuity:
            • White paper background with serif body text
            • Red bold "INTERNAL USE ONLY at Nordic Naturals®" in top-right
            • Page meta line on the left ("PCS-#### v#.#  Product Claims Substantiation (PCS)")
          The platform header above (sticky) keeps sans-serif chrome so the
          edit/version/export controls don't get confused with the document
          body. */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden font-serif">
        {/* Document-paper banner (red INTERNAL USE ONLY block, top of every Word page) */}
        <div className="border-b-2 border-red-700 bg-white px-6 py-3 sm:px-8 flex items-start justify-between gap-4">
          <div className="text-[13px] leading-tight">
            <div className="font-medium text-gray-900">{doc.pcsId}{version?.version ? ` v${version.version}` : 'v0.1'}</div>
            <div className="italic text-gray-700">Product Claims Substantiation (PCS)</div>
          </div>
          <div className="text-right text-red-700 font-bold text-[13px] leading-tight">
            <div>INTERNAL USE ONLY</div>
            <div>at Nordic Naturals<sup>®</sup></div>
          </div>
        </div>

        {/* Page body — sections render their banded headers + content here.
            The serif font is set on the wrapper so all child sections inherit
            it; tables get alternating row colors via the .pcs-paper class. */}
        <div className="px-6 py-6 sm:px-8 sm:py-8 space-y-8 pcs-paper">
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
        <PcsComposition
          formulaLines={formulaLines}
          canEdit={canWrite}
          allIngredients={allIngredients}
          onFormulaLineUpdated={(updated) => {
            setLocalFormulaLines(prev =>
              (prev ?? payloadFormulaLines).map(l => l.id === updated.id ? updated : l)
            );
          }}
        />
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
          canEdit={canWrite}
          doc={doc}
          version={version}
          user={user}
          onRequestReview={openClaimReviewSheet}
          onClaimUpdated={(updated) => {
            setLocalClaims(prev =>
              (prev ?? payloadClaims).map(c => c.id === updated.id ? updated : c)
            );
          }}
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
        </div>
        {/* Footer page-meta line — mirrors the bottom-right page number in
            the Word template. We can't compute true page numbers in a
            web view, so we surface the last edit + version instead. */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-2 sm:px-8 text-[11px] text-gray-500 italic flex items-center justify-between">
          <span>{doc.pcsId}{version?.version ? ` · v${version.version}` : ''}</span>
          <span>{doc.templateVersion ? `Template: ${doc.templateVersion}` : 'Template version not set'}</span>
        </div>
      </div>

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
