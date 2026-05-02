/**
 * PCS DOCX Report Generator
 *
 * Generates branded Word documents from PCS database state.
 * Uses the `docx` npm package for native .docx generation.
 *
 * Report types:
 * 1. Claims Summary — all claims grouped by bucket with evidence status
 * 2. Evidence Library — all evidence items with SQR scores and summaries
 * 3. Full PCS Report — comprehensive document with claims + evidence + gaps
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  PageBreak, Header, Footer, TabStopPosition, TabStopType,
} from 'docx';

const BRAND = {
  primary: '0077B6',    // Nordic blue
  green: '16A34A',
  yellow: 'CA8A04',
  red: 'DC2626',
  gray: '6B7280',
  lightGray: 'F3F4F6',
  white: 'FFFFFF',
};

const BUCKET_COLORS = {
  '3A': BRAND.green,
  '3B': BRAND.yellow,
  '3C': BRAND.red,
};

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

function headerFooter(title) {
  return {
    default: {
      header: new Header({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: 'Nordic Naturals — Product Claim Substantiation', size: 16, color: BRAND.gray, font: 'Calibri' }),
            ],
            alignment: AlignmentType.LEFT,
          }),
        ],
      }),
      footer: new Footer({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: `${title} — Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, size: 16, color: BRAND.gray, font: 'Calibri' }),
              new TextRun({ text: '\t', font: 'Calibri' }),
              new TextRun({ text: 'Confidential', size: 16, color: BRAND.gray, italics: true, font: 'Calibri' }),
            ],
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          }),
        ],
      }),
    },
  };
}

function titlePage(title, subtitle) {
  return [
    new Paragraph({ spacing: { before: 3000 } }),
    new Paragraph({
      children: [new TextRun({ text: 'Nordic Naturals', size: 32, color: BRAND.primary, font: 'Calibri', bold: true })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Product Claim Substantiation', size: 24, color: BRAND.gray, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    new Paragraph({
      children: [new TextRun({ text: title, size: 44, bold: true, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: subtitle, size: 22, color: BRAND.gray, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), size: 22, color: BRAND.gray, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
    }),
  ];
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ text, heading: level, spacing: { before: 300, after: 100 } });
}

function bodyText(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: 'Calibri', ...opts })],
    spacing: { after: 100 },
  });
}

function bulletItem(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: 'Calibri', ...opts })],
    bullet: { level: 0 },
    spacing: { after: 60 },
  });
}

function cell(text, opts = {}) {
  const { bold, color, shading, width, alignment } = opts;
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: String(text ?? '—'), size: 20, font: 'Calibri', bold, color })],
        alignment: alignment || AlignmentType.LEFT,
        spacing: { after: 0 },
      }),
    ],
    // OOXML pct type uses fiftieths-of-a-percent: 5000 = 100%
    width: width ? { size: width * 50, type: WidthType.PERCENTAGE } : undefined,
    shading: shading ? { type: ShadingType.SOLID, color: shading } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
  });
}

function headerCell(text, width) {
  return cell(text, { bold: true, color: BRAND.white, shading: BRAND.primary, width });
}

function tableRow(cells) {
  return new TableRow({ children: cells });
}

/**
 * Compute content-aware column widths that sum to 100%.
 *
 * @param {string[]} headers — column header labels
 * @param {string[][]} dataRows — array of rows, each an array of cell text values
 * @param {{ minWidth?: number, maxWeight?: number }} opts
 * @returns {number[]} — percentage widths for each column
 */
function autoWidths(headers, dataRows, opts = {}) {
  const { minWidth = 6, maxWeight = 60 } = opts;
  const colCount = headers.length;

  // Find the max content length per column (header + data)
  const maxLens = headers.map(h => String(h).length);
  for (const row of dataRows) {
    for (let i = 0; i < colCount; i++) {
      const len = String(row[i] ?? '').length;
      if (len > maxLens[i]) maxLens[i] = len;
    }
  }

  // Cap individual weights so one huge column doesn't dominate
  const weights = maxLens.map(len => Math.min(len, maxWeight));
  const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;

  // Distribute proportionally, enforce minimum
  let widths = weights.map(w => Math.max(minWidth, Math.round((w / totalWeight) * 100)));

  // Adjust to sum to exactly 100
  const sum = widths.reduce((s, w) => s + w, 0);
  if (sum !== 100) {
    // Add/subtract the difference from the widest column
    const maxIdx = widths.indexOf(Math.max(...widths));
    widths[maxIdx] += 100 - sum;
  }

  return widths;
}

/**
 * Build a full table with auto-computed column widths.
 *
 * @param {string[]} headers — column labels
 * @param {Array<{ texts: string[], opts?: object[] }>} dataRows — cell texts + optional per-cell opts
 * @param {{ tableWidth?: object }} tableOpts
 * @returns {Table}
 */
function autoTable(headers, dataRows, tableOpts = {}) {
  const plainRows = dataRows.map(r => r.texts);
  const widths = autoWidths(headers, plainRows);

  const headerRow = tableRow(headers.map((h, i) => headerCell(h, widths[i])));

  const bodyRows = dataRows.map(r =>
    tableRow(r.texts.map((text, i) => {
      const cellOpts = r.opts?.[i] || {};
      return cell(text, { ...cellOpts, width: widths[i] });
    }))
  );

  return new Table({
    rows: [headerRow, ...bodyRows],
    width: tableOpts.tableWidth || { size: 100, type: WidthType.PERCENTAGE },
  });
}

// ─────────────────────────────────────────────
// Report 1: Claims Summary
// ─────────────────────────────────────────────

export function generateClaimsSummary(claims, evidencePackets, evidenceItems) {
  // Build lookup: claimId → packets, evidenceItemId → item
  const packetsByClaimId = {};
  for (const ep of evidencePackets) {
    if (!ep.pcsClaimId) continue;
    (packetsByClaimId[ep.pcsClaimId] ||= []).push(ep);
  }
  const evidenceById = {};
  for (const e of evidenceItems) {
    evidenceById[e.id] = e;
  }

  // Group claims by bucket
  const byBucket = { '3A': [], '3B': [], '3C': [], 'Other': [] };
  for (const c of claims) {
    const bucket = c.claimBucket && byBucket[c.claimBucket] ? c.claimBucket : 'Other';
    byBucket[bucket].push(c);
  }

  // Summary stats
  const total = claims.length;
  const authorized = claims.filter(c => c.claimStatus === 'Authorized').length;
  const proposed = claims.filter(c => c.claimStatus === 'Proposed' || !c.claimStatus).length;
  const rejected = claims.filter(c => c.claimStatus === 'Not approved').length;
  const noEvidence = claims.filter(c => !c.evidencePacketIds?.length).length;

  const sections = [
    ...titlePage('Claims Summary Report', `${total} claims across ${Object.keys(byBucket).filter(k => byBucket[k].length > 0).length} evidence tiers`),
    new Paragraph({ children: [new PageBreak()] }),

    // Executive summary
    heading('Executive Summary'),
    bodyText(`This report summarizes ${total} product claims in the Nordic Naturals PCS system.`),
    new Paragraph({ spacing: { after: 100 } }),

    // Summary table
    autoTable(
      ['Metric', 'Count', 'Percentage'],
      [
        { texts: ['Total Claims', String(total), '100%'], opts: [null, { alignment: AlignmentType.CENTER }, { alignment: AlignmentType.CENTER }] },
        { texts: ['Authorized', String(authorized), `${total ? Math.round(authorized / total * 100) : 0}%`], opts: [{ color: BRAND.green }, { alignment: AlignmentType.CENTER }, { alignment: AlignmentType.CENTER }] },
        { texts: ['Pending Review', String(proposed), `${total ? Math.round(proposed / total * 100) : 0}%`], opts: [{ color: BRAND.yellow }, { alignment: AlignmentType.CENTER }, { alignment: AlignmentType.CENTER }] },
        { texts: ['Not Approved', String(rejected), `${total ? Math.round(rejected / total * 100) : 0}%`], opts: [{ color: BRAND.red }, { alignment: AlignmentType.CENTER }, { alignment: AlignmentType.CENTER }] },
        { texts: ['Evidence Gaps', String(noEvidence), `${total ? Math.round(noEvidence / total * 100) : 0}%`], opts: [{ color: BRAND.red, bold: true }, { alignment: AlignmentType.CENTER, bold: true }, { alignment: AlignmentType.CENTER, bold: true }] },
      ],
    ),
    new Paragraph({ spacing: { after: 200 } }),
  ];

  // Claims by bucket
  for (const [bucket, bucketClaims] of Object.entries(byBucket)) {
    if (bucketClaims.length === 0) continue;

    const bucketLabel = bucket === 'Other' ? 'Unclassified' : `Bucket ${bucket}`;
    const bucketDesc = bucket === '3A' ? '(Strongest evidence tier — RCTs, systematic reviews)'
      : bucket === '3B' ? '(Moderate evidence — observational, mechanistic studies)'
      : bucket === '3C' ? '(Preliminary evidence — pilot studies, in vitro)'
      : '';

    sections.push(
      heading(`${bucketLabel} — ${bucketClaims.length} claims`, HeadingLevel.HEADING_1),
      bodyText(bucketDesc, { italics: true, color: BRAND.gray }),
    );

    // Claims table — auto-width from content
    const claimDataRows = bucketClaims.map(c => {
      const packets = packetsByClaimId[c.id] || [];
      const evidenceCount = packets.length;
      const sqrPassCount = packets.filter(p => p.meetsSqrThreshold).length;
      const evidenceText = evidenceCount === 0 ? 'NO EVIDENCE' : `${evidenceCount} (${sqrPassCount} SQR pass)`;
      const statusColor = c.claimStatus === 'Authorized' ? BRAND.green : c.claimStatus === 'Not approved' ? BRAND.red : BRAND.yellow;
      return {
        texts: [c.claimNo || '—', c.claim || 'Untitled', c.claimStatus || 'Pending', evidenceText, c.disclaimerRequired ? 'Yes' : 'No', c.claimNotes ? 'Yes' : '—'],
        opts: [{ alignment: AlignmentType.CENTER }, null, { color: statusColor }, { color: evidenceCount === 0 ? BRAND.red : BRAND.gray }, null, { alignment: AlignmentType.CENTER }],
      };
    });

    sections.push(
      autoTable(['#', 'Claim', 'Status', 'Evidence', 'Disclaimer', 'Notes'], claimDataRows),
      new Paragraph({ spacing: { after: 200 } }),
    );

    // Detail for each claim with evidence
    for (const c of bucketClaims) {
      const packets = packetsByClaimId[c.id] || [];
      if (packets.length === 0) continue;

      sections.push(
        heading(`Claim #${c.claimNo || '—'}: ${(c.claim || '').substring(0, 80)}${(c.claim || '').length > 80 ? '...' : ''}`, HeadingLevel.HEADING_3),
      );

      if (c.claimNotes) {
        sections.push(bodyText(`Notes: ${c.claimNotes}`, { italics: true, color: BRAND.gray }));
      }

      if (c.minDoseMg || c.maxDoseMg) {
        const dose = c.minDoseMg && c.maxDoseMg
          ? `${c.minDoseMg}–${c.maxDoseMg} mg`
          : c.minDoseMg ? `${c.minDoseMg}+ mg` : `Up to ${c.maxDoseMg} mg`;
        sections.push(bodyText(`Dose guidance: ${dose}${c.doseGuidanceNote ? ` — ${c.doseGuidanceNote}` : ''}`));
      }

      sections.push(bodyText(`Linked evidence (${packets.length}):`));

      for (const ep of packets) {
        const item = ep.evidenceItemId ? evidenceById[ep.evidenceItemId] : null;
        const name = ep.name || item?.name || 'Untitled';
        const sqrBadge = ep.meetsSqrThreshold ? '[SQR PASS]' : '[SQR FAIL]';
        const role = ep.evidenceRole ? ` (${ep.evidenceRole})` : '';

        sections.push(
          bulletItem(`${sqrBadge} ${name}${role}`, { color: ep.meetsSqrThreshold ? BRAND.green : BRAND.red }),
        );

        if (item?.citation) {
          sections.push(bodyText(`    ${item.citation}`, { size: 18, color: BRAND.gray, italics: true }));
        }
        if (ep.relevanceNote) {
          sections.push(bodyText(`    Relevance: ${ep.relevanceNote}`, { size: 18, color: BRAND.gray }));
        }
      }

      sections.push(new Paragraph({ spacing: { after: 100 } }));
    }
  }

  // Evidence gaps section
  const gapClaims = claims.filter(c => !c.evidencePacketIds?.length);
  if (gapClaims.length > 0) {
    sections.push(
      new Paragraph({ children: [new PageBreak()] }),
      heading('Evidence Gaps — Claims Without Linked Evidence'),
      bodyText(`${gapClaims.length} claims have no linked evidence packets. These represent substantiation gaps that should be addressed before regulatory submission.`, { color: BRAND.red }),
      new Paragraph({ spacing: { after: 100 } }),
    );

    for (const c of gapClaims) {
      sections.push(
        bulletItem(`#${c.claimNo || '—'} [${c.claimBucket || '?'}] ${c.claim || 'Untitled'}`, { color: BRAND.red }),
      );
    }
  }

  return new Document({
    sections: [{
      headers: headerFooter('Claims Summary').default.header ? { default: headerFooter('Claims Summary').default.header } : undefined,
      footers: headerFooter('Claims Summary').default.footer ? { default: headerFooter('Claims Summary').default.footer } : undefined,
      children: sections,
    }],
  });
}

// ─────────────────────────────────────────────
// Report 2: Evidence Library
// ─────────────────────────────────────────────

export function generateEvidenceReport(evidenceItems, evidencePackets) {
  // Build lookup: evidenceItemId → claims it supports
  const packetsByEvidenceId = {};
  for (const ep of evidencePackets) {
    if (!ep.evidenceItemId) continue;
    (packetsByEvidenceId[ep.evidenceItemId] ||= []).push(ep);
  }

  const total = evidenceItems.length;
  const sqrReviewed = evidenceItems.filter(e => e.sqrReviewed).length;
  const withScore = evidenceItems.filter(e => e.sqrScore != null).length;
  const avgScore = withScore > 0
    ? (evidenceItems.filter(e => e.sqrScore != null).reduce((s, e) => s + e.sqrScore, 0) / withScore).toFixed(1)
    : 'N/A';

  // Group by ingredient
  const byIngredient = {};
  for (const e of evidenceItems) {
    const ingredients = e.ingredient?.length ? e.ingredient : ['Untagged'];
    for (const ing of ingredients) {
      (byIngredient[ing] ||= []).push(e);
    }
  }

  const sections = [
    ...titlePage('Evidence Library Report', `${total} evidence items across ${Object.keys(byIngredient).length} ingredients`),
    new Paragraph({ children: [new PageBreak()] }),

    heading('Overview'),
    autoTable(
      ['Metric', 'Value'],
      [
        { texts: ['Total evidence items', String(total)], opts: [null, { alignment: AlignmentType.CENTER }] },
        { texts: ['SQR-RCT reviewed', `${sqrReviewed} (${total ? Math.round(sqrReviewed / total * 100) : 0}%)`], opts: [null, { alignment: AlignmentType.CENTER }] },
        { texts: ['Items with SQR score', String(withScore)], opts: [null, { alignment: AlignmentType.CENTER }] },
        { texts: ['Average SQR score', String(avgScore)], opts: [null, { alignment: AlignmentType.CENTER }] },
        { texts: ['Unreviewed', String(total - sqrReviewed)], opts: [null, { alignment: AlignmentType.CENTER, color: total - sqrReviewed > 0 ? BRAND.red : BRAND.green }] },
      ],
    ),
    new Paragraph({ spacing: { after: 300 } }),
  ];

  // Evidence by ingredient
  const sortedIngredients = Object.entries(byIngredient).sort(([a], [b]) => a.localeCompare(b));

  for (const [ingredient, items] of sortedIngredients) {
    sections.push(
      heading(`${ingredient} — ${items.length} items`, HeadingLevel.HEADING_2),
    );

    const evidenceDataRows = items.map(e => {
      const packets = packetsByEvidenceId[e.id] || [];
      const identifier = e.doi || (e.pmid ? `PMID: ${e.pmid}` : '—');
      const sqrText = e.sqrScore != null ? String(e.sqrScore) : (e.sqrReviewed ? 'Reviewed' : 'Not reviewed');
      const sqrColor = e.sqrScore != null ? (e.sqrScore >= 7 ? BRAND.green : e.sqrScore >= 4 ? BRAND.yellow : BRAND.red) : BRAND.gray;
      return {
        texts: [e.name || 'Untitled', e.evidenceType || '—', String(e.publicationYear || '—'), sqrText, identifier.length > 30 ? identifier.substring(0, 30) + '...' : identifier, String(packets.length || '—'), e.canonicalSummary ? 'Yes' : '—'],
        opts: [null, null, { alignment: AlignmentType.CENTER }, { color: sqrColor, alignment: AlignmentType.CENTER }, null, { alignment: AlignmentType.CENTER }, { alignment: AlignmentType.CENTER }],
      };
    });

    sections.push(
      autoTable(['Name', 'Type', 'Year', 'SQR', 'DOI/PMID', 'Claims', 'Summary'], evidenceDataRows),
      new Paragraph({ spacing: { after: 200 } }),
    );
  }

  // Unreviewed items section
  const unreviewed = evidenceItems.filter(e => !e.sqrReviewed);
  if (unreviewed.length > 0) {
    sections.push(
      new Paragraph({ children: [new PageBreak()] }),
      heading('Items Pending SQR-RCT Review'),
      bodyText(`${unreviewed.length} evidence items have not yet been reviewed through the SQR-RCT quality assessment process.`, { color: BRAND.red }),
      new Paragraph({ spacing: { after: 100 } }),
    );

    for (const e of unreviewed.slice(0, 50)) {
      sections.push(
        bulletItem(`${e.name || 'Untitled'} (${e.evidenceType || 'unknown type'}, ${e.publicationYear || 'no year'})${e.ingredient?.length ? ' — ' + e.ingredient.join(', ') : ''}`),
      );
    }

    if (unreviewed.length > 50) {
      sections.push(bodyText(`...and ${unreviewed.length - 50} more items.`, { italics: true, color: BRAND.gray }));
    }
  }

  return new Document({
    sections: [{
      headers: { default: headerFooter('Evidence Library').default.header },
      footers: { default: headerFooter('Evidence Library').default.footer },
      children: sections,
    }],
  });
}

// ─────────────────────────────────────────────
// Report 3: Full PCS Report (comprehensive)
// ─────────────────────────────────────────────

export function generateFullReport(documents, claims, evidenceItems, evidencePackets, requests) {
  const packetsByClaimId = {};
  for (const ep of evidencePackets) {
    if (!ep.pcsClaimId) continue;
    (packetsByClaimId[ep.pcsClaimId] ||= []).push(ep);
  }
  const evidenceById = {};
  for (const e of evidenceItems) {
    evidenceById[e.id] = e;
  }

  const totalClaims = claims.length;
  const authorized = claims.filter(c => c.claimStatus === 'Authorized').length;
  const noEvidence = claims.filter(c => !c.evidencePacketIds?.length).length;
  const openRequests = requests.filter(r => r.status !== 'Complete' && r.status !== 'Cancelled').length;

  const sections = [
    ...titlePage('Comprehensive PCS Report', 'Full portfolio status, claims, evidence, and action items'),
    new Paragraph({ children: [new PageBreak()] }),

    // Table of contents note
    heading('Report Contents'),
    bulletItem('1. Portfolio Overview — document status summary'),
    bulletItem('2. Claims Status — authorization progress by evidence tier'),
    bulletItem('3. Evidence Gaps — claims requiring additional substantiation'),
    bulletItem('4. Open Requests — pending regulatory and research actions'),
    bulletItem('5. Recommendations — prioritized next steps'),
    new Paragraph({ children: [new PageBreak()] }),

    // Section 1: Portfolio
    heading('1. Portfolio Overview'),
    bodyText(`The PCS portfolio contains ${documents.length} documents.`),
    new Paragraph({ spacing: { after: 100 } }),

    autoTable(
      ['PCS ID', 'Classification', 'File Status', 'Product Status', 'Approved'],
      documents.map(d => ({
        texts: [d.pcsId || '—', d.classification || '—', d.fileStatus || '—', d.productStatus || '—', d.approvedDate || '—'],
      })),
    ),
    new Paragraph({ spacing: { after: 200 } }),

    // Section 2: Claims
    heading('2. Claims Status'),
    bodyText(`${totalClaims} total claims — ${authorized} authorized (${totalClaims ? Math.round(authorized / totalClaims * 100) : 0}%), ${noEvidence} with evidence gaps.`),
    new Paragraph({ spacing: { after: 100 } }),
  ];

  // Claims by bucket
  const byBucket = { '3A': [], '3B': [], '3C': [], 'Other': [] };
  for (const c of claims) {
    const bucket = c.claimBucket && byBucket[c.claimBucket] ? c.claimBucket : 'Other';
    byBucket[bucket].push(c);
  }

  for (const [bucket, bucketClaims] of Object.entries(byBucket)) {
    if (bucketClaims.length === 0) continue;

    const bucketAuth = bucketClaims.filter(c => c.claimStatus === 'Authorized').length;
    const bucketLabel = bucket === 'Other' ? 'Unclassified' : `Bucket ${bucket}`;

    sections.push(
      heading(`${bucketLabel} — ${bucketClaims.length} claims (${bucketAuth} authorized)`, HeadingLevel.HEADING_2),
    );

    const fullClaimRows = bucketClaims.map(c => {
      const packets = packetsByClaimId[c.id] || [];
      return {
        texts: [c.claimNo || '—', c.claim || 'Untitled', c.claimStatus || 'Pending', packets.length === 0 ? 'NONE' : `${packets.length} items`, c.disclaimerRequired ? 'Required' : '—'],
        opts: [{ alignment: AlignmentType.CENTER }, null, { color: c.claimStatus === 'Authorized' ? BRAND.green : c.claimStatus === 'Not approved' ? BRAND.red : BRAND.yellow }, { color: packets.length === 0 ? BRAND.red : BRAND.gray }, null],
      };
    });

    sections.push(
      autoTable(['#', 'Claim', 'Status', 'Evidence', 'Disclaimer'], fullClaimRows),
      new Paragraph({ spacing: { after: 200 } }),
    );
  }

  // Section 3: Evidence gaps
  const gapClaims = claims.filter(c => !c.evidencePacketIds?.length);
  sections.push(
    new Paragraph({ children: [new PageBreak()] }),
    heading('3. Evidence Gaps'),
    bodyText(gapClaims.length > 0
      ? `${gapClaims.length} claims currently have no linked evidence. These are listed below, prioritized by evidence tier.`
      : 'All claims have at least one linked evidence item. No gaps detected.',
      { color: gapClaims.length > 0 ? BRAND.red : BRAND.green }
    ),
    new Paragraph({ spacing: { after: 100 } }),
  );

  if (gapClaims.length > 0) {
    // Sort: 3A first, then 3B, 3C, Other
    const sortedGaps = [...gapClaims].sort((a, b) => {
      const order = { '3A': 0, '3B': 1, '3C': 2 };
      return (order[a.claimBucket] ?? 3) - (order[b.claimBucket] ?? 3);
    });

    const gapDataRows = sortedGaps.map(c => ({
      texts: [c.claimNo || '—', c.claimBucket || '—', c.claim || 'Untitled', c.claimStatus || 'Pending', c.disclaimerRequired ? 'Required' : '—'],
      opts: [{ alignment: AlignmentType.CENTER }, { color: BUCKET_COLORS[c.claimBucket] || BRAND.gray }, null, null, null],
    }));

    sections.push(
      autoTable(['#', 'Bucket', 'Claim', 'Status', 'Disclaimer'], gapDataRows),
      new Paragraph({ spacing: { after: 200 } }),
    );
  }

  // Section 4: Open requests
  const open = requests.filter(r => r.status !== 'Complete' && r.status !== 'Cancelled');
  sections.push(
    heading('4. Open Requests'),
    bodyText(open.length > 0
      ? `${open.length} requests are currently open.`
      : 'No open requests.'
    ),
    new Paragraph({ spacing: { after: 100 } }),
  );

  if (open.length > 0) {
    const reqDataRows = open.map(r => ({
      texts: [r.request || 'Untitled', r.status || '—', r.raDue || '—', r.resDue || '—', r.requestedBy || '—'],
    }));

    sections.push(
      autoTable(['Request', 'Status', 'RA Due', 'RES Due', 'Requested By'], reqDataRows),
      new Paragraph({ spacing: { after: 200 } }),
    );
  }

  // Section 5: Recommendations
  sections.push(
    new Paragraph({ children: [new PageBreak()] }),
    heading('5. Recommendations'),
  );

  const recommendations = [];

  if (gapClaims.length > 0) {
    const gap3A = gapClaims.filter(c => c.claimBucket === '3A').length;
    if (gap3A > 0) {
      recommendations.push(`CRITICAL: ${gap3A} Bucket 3A claims lack evidence. These are the highest-tier claims and should be prioritized for evidence linking.`);
    }
    recommendations.push(`${gapClaims.length} total claims need evidence linked. Run an evidence matching pass across the Evidence Library.`);
  }

  const unreviewed = evidenceItems.filter(e => !e.sqrReviewed);
  if (unreviewed.length > 0) {
    recommendations.push(`${unreviewed.length} evidence items have not been SQR-RCT reviewed. Schedule quality assessments for these items.`);
  }

  if (open.length > 0) {
    const overdue = open.filter(r => {
      const due = r.raDue || r.resDue;
      return due && new Date(due) < new Date();
    });
    if (overdue.length > 0) {
      recommendations.push(`${overdue.length} requests are past due. Address these before proceeding with new claims.`);
    }
  }

  const pendingClaims = claims.filter(c => !c.claimStatus || c.claimStatus === 'Proposed' || c.claimStatus === 'Unknown');
  if (pendingClaims.length > 0) {
    recommendations.push(`${pendingClaims.length} claims are pending RA review. Use the Review Queue to process these efficiently.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('No critical issues detected. Continue regular review cycles.');
  }

  for (const rec of recommendations) {
    sections.push(bulletItem(rec));
  }

  return new Document({
    sections: [{
      headers: { default: headerFooter('Full PCS Report').default.header },
      footers: { default: headerFooter('Full PCS Report').default.footer },
      children: sections,
    }],
  });
}

// ─────────────────────────────────────────────
// Report 4: Lauren Template (Wave 4.3.4)
// ─────────────────────────────────────────────

/**
 * Generate a docx that mirrors Lauren's 10-table PCS layout.
 *
 * Inputs are all optional — empty sections render a "No entries for this
 * version." note rather than crashing. When the source document predates the
 * Lauren v1.0 template (`doc.templateVersion === 'Legacy pre-Lauren'`), a
 * prominent disclaimer is inserted under the cover page.
 *
 * @param {object} doc — Documents row
 * @param {object|null} version — resolved latest Version row
 * @param {Array} claims
 * @param {Array} formulaLines
 * @param {Array} evidencePackets
 * @param {Array} revisionEvents
 * @param {Array} references
 * @returns {Document}
 */
export function generateLaurenTemplateDocx(
  doc,
  version,
  claims = [],
  formulaLines = [],
  evidencePackets = [],
  revisionEvents = [],
  references = [],
) {
  const isLegacy = doc?.templateVersion === 'Legacy pre-Lauren';
  const pcsId = doc?.pcsId || '(no PCS ID)';
  const productName = doc?.finishedGoodName || version?.productName || '(no product name)';
  const fmt = doc?.format || '(no format)';
  const approvedDate = doc?.approvedDate || '—';

  const sections = [];

  // Cover page
  sections.push(
    new Paragraph({ spacing: { before: 2400 } }),
    new Paragraph({
      children: [new TextRun({ text: 'Nordic Naturals', size: 32, color: BRAND.primary, bold: true, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Product Claim Substantiation', size: 24, color: BRAND.gray, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    new Paragraph({
      children: [new TextRun({ text: productName, size: 44, bold: true, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `PCS ${pcsId} · ${fmt}`, size: 24, color: BRAND.gray, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Approved: ${approvedDate}`, size: 22, color: BRAND.gray, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Template version: ${doc?.templateVersion || 'Unknown'}`, size: 20, color: BRAND.gray, italics: true, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
    }),
  );

  if (isLegacy) {
    sections.push(
      new Paragraph({ spacing: { before: 400 } }),
      new Paragraph({
        children: [new TextRun({
          text: 'This document predates the Lauren v1.0 template. Sections may be partial or empty.',
          size: 22, bold: true, color: BRAND.red, font: 'Calibri',
        })],
        alignment: AlignmentType.CENTER,
        shading: { type: ShadingType.SOLID, color: 'FEF2F2' },
        spacing: { after: 200 },
      }),
    );
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));

  // ── Table A — Revision History ──
  sections.push(heading('Table A — Revision History', HeadingLevel.HEADING_2));
  if (!revisionEvents?.length) {
    sections.push(bodyText('No entries for this version.', { italics: true, color: BRAND.gray }));
  } else {
    sections.push(
      autoTable(
        ['Date', 'Version', 'Change', 'Requested by', 'Approved by'],
        revisionEvents.map(e => ({
          texts: [
            e.eventDate || e.date || '—',
            e.version || '—',
            e.description || e.changeDescription || e.notes || '—',
            e.requestedBy || '—',
            e.approvedBy || '—',
          ],
        })),
      ),
    );
  }
  sections.push(new Paragraph({ spacing: { after: 240 } }));

  // ── Table B — Applicable Products ──
  sections.push(heading('Table B — Applicable Products', HeadingLevel.HEADING_2));
  const skus = Array.isArray(doc?.skus) ? doc.skus : [];
  sections.push(
    autoTable(
      ['Finished Good Name', 'Format', 'SAP Material No.', 'SKUs'],
      [{ texts: [
        doc?.finishedGoodName || '—',
        doc?.format || '—',
        doc?.sapMaterialNo || '—',
        skus.length ? skus.join(', ') : '—',
      ] }],
    ),
  );
  sections.push(new Paragraph({ spacing: { after: 240 } }));

  // ── Table 1 — Product Details ──
  sections.push(heading('Table 1 — Product Details', HeadingLevel.HEADING_2));
  const axesPopulated =
    Array.isArray(version?.biologicalSex) && version.biologicalSex.length > 0 ||
    Array.isArray(version?.ageGroup) && version.ageGroup.length > 0 ||
    Array.isArray(version?.lifeStage) && version.lifeStage.length > 0 ||
    Array.isArray(version?.lifestyle) && version.lifestyle.length > 0;
  if (!version) {
    sections.push(bodyText('No entries for this version.', { italics: true, color: BRAND.gray }));
  } else if (axesPopulated) {
    sections.push(
      autoTable(
        ['Axis', 'Values'],
        [
          { texts: ['Biological sex', (version.biologicalSex || []).join(', ') || '—'] },
          { texts: ['Age group', (version.ageGroup || []).join(', ') || '—'] },
          { texts: ['Life stage', (version.lifeStage || []).join(', ') || '—'] },
          { texts: ['Lifestyle', (version.lifestyle || []).join(', ') || '—'] },
        ],
      ),
    );
  } else {
    const legacyDemo = Array.isArray(version.demographic) ? version.demographic : [];
    sections.push(
      autoTable(
        ['Field', 'Value'],
        [
          { texts: ['Product name', version.productName || doc?.finishedGoodName || '—'] },
          { texts: ['Demographic (legacy)', legacyDemo.length ? legacyDemo.join(', ') : '—'] },
        ],
      ),
    );
  }
  sections.push(new Paragraph({ spacing: { after: 240 } }));

  // ── Table 2 — Product Composition ──
  sections.push(heading('Table 2 — Product Composition', HeadingLevel.HEADING_2));
  if (!formulaLines?.length) {
    sections.push(bodyText('No entries for this version.', { italics: true, color: BRAND.gray }));
  } else {
    sections.push(
      autoTable(
        ['Ingredient', 'Amount', 'Unit', '% DV', 'FM PLM#', 'Notes'],
        formulaLines.map(l => ({
          texts: [
            l.ingredientName || l.ingredient || '—',
            l.amount != null ? String(l.amount) : '—',
            l.unit || '—',
            l.percentDv != null ? `${l.percentDv}%` : '—',
            l.fmPlm || '—',
            l.notes || '—',
          ],
        })),
      ),
    );
  }
  sections.push(new Paragraph({ spacing: { after: 240 } }));

  // ── Tables 3A/3B/3C — Claims by bucket ──
  const byBucket = { '3A': [], '3B': [], '3C': [] };
  for (const c of claims) {
    const b = c.claimBucket && byBucket[c.claimBucket] ? c.claimBucket : '3A';
    byBucket[b].push(c);
  }
  const BUCKET_LABELS = {
    '3A': 'Table 3A — Primary claims',
    '3B': 'Table 3B — Secondary claims',
    '3C': 'Table 3C — Supporting claims',
  };
  for (const b of ['3A', '3B', '3C']) {
    sections.push(heading(BUCKET_LABELS[b], HeadingLevel.HEADING_3));
    const rows = byBucket[b];
    if (!rows.length) {
      sections.push(bodyText('No entries for this version.', { italics: true, color: BRAND.gray }));
    } else {
      sections.push(
        autoTable(
          ['#', 'Claim', 'Status', 'Disclaimer', 'Notes'],
          rows.map(c => ({
            texts: [
              c.claimNo || '—',
              c.claim || '—',
              c.claimStatus || 'Pending',
              c.disclaimerRequired ? 'Yes' : '—',
              c.claimNotes || '—',
            ],
            opts: [
              { alignment: AlignmentType.CENTER },
              null,
              { color: c.claimStatus === 'Authorized' ? BRAND.green : c.claimStatus === 'Not approved' ? BRAND.red : BRAND.yellow },
              null,
              null,
            ],
          })),
        ),
      );
    }
    sections.push(new Paragraph({ spacing: { after: 180 } }));
  }

  // ── Table 4 — Research Summary ──
  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(heading('Table 4 — Research Summary', HeadingLevel.HEADING_2));
  const supportive = (evidencePackets || []).filter(
    ep => !ep.substantiationTier || ep.substantiationTier === 'Supportive' || ep.meetsSqrThreshold,
  );
  if (!supportive.length) {
    sections.push(bodyText('No entries for this version.', { italics: true, color: BRAND.gray }));
  } else {
    sections.push(
      autoTable(
        ['Evidence', 'Role', 'SQR', 'Key Takeaway'],
        supportive.map(ep => ({
          texts: [
            ep.name || '—',
            ep.evidenceRole || '—',
            ep.meetsSqrThreshold ? 'Pass' : 'Fail',
            ep.keyTakeaway || ep.relevanceNote || '—',
          ],
          opts: [null, null, { color: ep.meetsSqrThreshold ? BRAND.green : BRAND.red, alignment: AlignmentType.CENTER }, null],
        })),
      ),
    );
  }
  sections.push(new Paragraph({ spacing: { after: 240 } }));

  // ── Table 5 — Supporting Documentation ──
  sections.push(heading('Table 5 — Supporting Documentation', HeadingLevel.HEADING_2));
  const supportingDocs = (evidencePackets || []).filter(
    ep => ep.substantiationTier === 'Supporting documentation' || ep.evidenceRole === 'Supporting',
  );
  if (!supportingDocs.length) {
    sections.push(bodyText('No entries for this version.', { italics: true, color: BRAND.gray }));
  } else {
    sections.push(
      autoTable(
        ['Document', 'Role', 'Notes'],
        supportingDocs.map(ep => ({
          texts: [ep.name || '—', ep.evidenceRole || '—', ep.relevanceNote || ep.keyTakeaway || '—'],
        })),
      ),
    );
  }
  sections.push(new Paragraph({ spacing: { after: 240 } }));

  // ── Table 6 — Null Results ──
  sections.push(heading('Table 6 — Null Results', HeadingLevel.HEADING_2));
  const nullish = (evidencePackets || []).filter(
    ep => ep.substantiationTier === 'Null' || ep.neutralResults || ep.negativeResults,
  );
  if (!nullish.length) {
    sections.push(bodyText('No entries for this version.', { italics: true, color: BRAND.gray }));
  } else {
    sections.push(
      autoTable(
        ['Evidence', 'Neutral', 'Negative', 'Potential Biases'],
        nullish.map(ep => ({
          texts: [
            ep.name || '—',
            ep.neutralResults || '—',
            ep.negativeResults || '—',
            ep.potentialBiases || '—',
          ],
        })),
      ),
    );
  }
  sections.push(new Paragraph({ spacing: { after: 240 } }));

  // ── References ──
  sections.push(heading('References', HeadingLevel.HEADING_2));
  if (!references?.length) {
    sections.push(bodyText('No entries for this version.', { italics: true, color: BRAND.gray }));
  } else {
    references.forEach((ref, idx) => {
      const citation = ref.citation || ref.name || '—';
      const suffix = ref.doi ? ` doi:${ref.doi}` : ref.pmid ? ` PMID:${ref.pmid}` : '';
      sections.push(bodyText(`${idx + 1}. ${citation}${suffix}`));
    });
  }

  const hf = headerFooter('Lauren Template');
  return new Document({
    sections: [{
      headers: { default: hf.default.header },
      footers: { default: hf.default.footer },
      children: sections,
    }],
  });
}

// ─────────────────────────────────────────────
// Buffer export
// ─────────────────────────────────────────────

export async function packDocument(doc) {
  return Packer.toBuffer(doc);
}
