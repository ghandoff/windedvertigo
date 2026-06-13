/**
 * POST /api/pcs/explore/dossier
 *
 * Budget C Preview — Substantiation Dossier export.
 * Super-user-only via pcs.dossier:export capability.
 *
 * Body: {
 *   claimIds: string[],    // claim IDs to include
 *   signedOffBy?: string,  // human reviewer name — required for final export
 *                          // omit → DRAFT watermark is applied
 * }
 *
 * Returns a .docx binary via Content-Disposition: attachment.
 *
 * Human-in-the-loop mandate (§2.2 of build prompt): the export is
 * DRAFT-watermarked until `signedOffBy` is provided. The platform never
 * presents an unsigned dossier as authoritative.
 */

import { NextResponse } from 'next/server';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle,
  Header, Footer, TabStopPosition, TabStopType,
} from 'docx';
import { requireCapability } from '@/lib/auth/require-capability';
import { buildExplorerIndex, computeSubstantiationStatus, normalizeSqrScore } from '@/lib/pcs-explorer';

export const revalidate = 0;

const BRAND = {
  primary: '0077B6',
  green: '16A34A',
  yellow: 'CA8A04',
  red: 'DC2626',
  gray: '6B7280',
  draftRed: 'DC2626',
};

const STATUS_COLOR = {
  'Supported': BRAND.green,
  'Thin': BRAND.yellow,
  'Unsupported': BRAND.red,
};

function bold(text, opts = {}) {
  return new TextRun({ text, bold: true, font: 'Calibri', ...opts });
}
function normal(text, opts = {}) {
  return new TextRun({ text, font: 'Calibri', ...opts });
}
function para(children, opts = {}) {
  return new Paragraph({ children: Array.isArray(children) ? children : [children], font: 'Calibri', ...opts });
}

function sectionHeading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, color: BRAND.primary, font: 'Calibri' })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 120 },
  });
}

function statusBadge(status) {
  const color = STATUS_COLOR[status] || BRAND.gray;
  return new TextRun({ text: ` [${status}] `, bold: true, color, font: 'Calibri' });
}

function claimSection(row, evidenceItems, relevantScores) {
  const children = [];

  // Claim heading
  children.push(new Paragraph({
    children: [
      new TextRun({ text: row.claimText, bold: true, size: 24, font: 'Calibri' }),
      statusBadge(row.status),
    ],
    spacing: { before: 360, after: 80 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
    },
  }));

  // Claim metadata
  const metaItems = [
    row.ingredient ? `Ingredient: ${row.ingredient.name}` : null,
    row.dose ? `Dose: ${row.dose}` : null,
    row.benefitCategory ? `Benefit Category: ${row.benefitCategory.name}` : null,
    row.claimBucket ? `Claim Bucket: Table ${row.claimBucket}` : null,
  ].filter(Boolean);

  if (metaItems.length > 0) {
    children.push(para([normal(metaItems.join('  ·  '), { color: BRAND.gray, size: 18 })], {
      spacing: { before: 80, after: 120 },
    }));
  }

  // Evidence summary
  children.push(sectionHeading('Supporting Evidence'));

  const { evidenceCount, meanScore, scoreCount } = row.statusInputs;
  children.push(para([
    normal(`${evidenceCount} supporting ${evidenceCount === 1 ? 'study' : 'studies'}`),
    scoreCount > 0
      ? normal(` · Mean SQR-RCT score: ${(meanScore * 100).toFixed(0)}% (${scoreCount} scored)`, { color: BRAND.gray })
      : normal(' · No SQR-RCT scores on file', { color: BRAND.gray }),
  ], { spacing: { before: 80, after: 120 } }));

  // Evidence table
  if (evidenceItems.length > 0) {
    const tableRows = [
      new TableRow({
        children: ['Study', 'Type', 'SQR-RCT Score', 'DOI / PMID'].map(h =>
          new TableCell({
            children: [para([bold(h, { size: 18 })], { alignment: AlignmentType.CENTER })],
            shading: { fill: 'F3F4F6' },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
          })
        ),
        tableHeader: true,
      }),
      ...evidenceItems.map(ev => {
        const evScores = relevantScores.filter(s =>
          (s.studyRelation || []).includes(ev.id)
        );
        const normalizedScores = evScores.map(normalizeSqrScore).filter(s => s !== null);
        const meanEvScore = normalizedScores.length > 0
          ? normalizedScores.reduce((a, b) => a + b, 0) / normalizedScores.length
          : null;

        return new TableRow({
          children: [
            new TableCell({
              children: [para([normal(ev.name || ev.title || ev.id, { size: 18 })])],
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              width: { size: 45, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [para([normal(ev.evidenceType || ev.type || '—', { size: 18 })])],
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              width: { size: 20, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [para([normal(
                meanEvScore !== null ? `${(meanEvScore * 100).toFixed(0)}%` : 'Not scored',
                { size: 18, color: meanEvScore !== null ? BRAND.primary : BRAND.gray }
              )])],
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              width: { size: 15, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [para([normal(ev.doi || ev.pmid || '—', { size: 16, color: BRAND.gray })])],
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              width: { size: 20, type: WidthType.PERCENTAGE },
            }),
          ],
        });
      }),
    ];

    children.push(new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  }

  children.push(para([normal('')]));  // spacer

  return children;
}

export async function POST(request) {
  const gate = await requireCapability(request, 'pcs.dossier:export', {
    route: '/api/pcs/explore/dossier',
  });
  if (gate.error) return gate.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { claimIds, signedOffBy } = body || {};

  if (!Array.isArray(claimIds) || claimIds.length === 0) {
    return NextResponse.json({ error: 'claimIds array required' }, { status: 400 });
  }

  const isDraft = !signedOffBy || String(signedOffBy).trim().length === 0;
  const signedOffByName = isDraft ? null : String(signedOffBy).trim();

  // Build index and collect rows for requested claims
  const index = await buildExplorerIndex();
  const { claims, evidenceById, packetsByClaimId, scores } = index;

  const claimSet = new Set(claimIds);
  const selectedClaims = claims.filter(c => claimSet.has(c.id));

  if (selectedClaims.length === 0) {
    return NextResponse.json({ error: 'No claims found for provided IDs' }, { status: 404 });
  }

  const now = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const docSections = [];

  // Title page
  docSections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Substantiation Dossier',
          bold: true, size: 56, color: BRAND.primary, font: 'Calibri',
        }),
      ],
      spacing: { before: 1200, after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Nordic Naturals · Product Claim Substantiation', size: 24, color: BRAND.gray, font: 'Calibri' })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${now}`, size: 20, color: BRAND.gray, font: 'Calibri' })],
      spacing: { after: 120 },
    }),
  );

  if (isDraft) {
    docSections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '⚠  DRAFT — PENDING HUMAN REVIEW',
            bold: true, size: 32, color: BRAND.draftRed, font: 'Calibri',
          }),
        ],
        spacing: { before: 240, after: 120 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 3, color: BRAND.draftRed },
          bottom: { style: BorderStyle.SINGLE, size: 3, color: BRAND.draftRed },
        },
      }),
      new Paragraph({
        children: [new TextRun({
          text: 'This dossier has not been reviewed or signed off by a named human reviewer. '
            + 'Do not present as authoritative or share with external parties. '
            + 'A qualified Nordic RA team member must sign off before this document may be used in a regulatory or marketing context.',
          size: 18, color: BRAND.draftRed, italics: true, font: 'Calibri',
        })],
        spacing: { after: 400 },
      }),
    );
  } else {
    docSections.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Reviewed and signed off by: `, size: 20, font: 'Calibri' }),
          new TextRun({ text: signedOffByName, bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: ` · ${now}`, size: 20, color: BRAND.gray, font: 'Calibri' }),
        ],
        spacing: { before: 120, after: 400 },
      }),
    );
  }

  // Table of contents (simple list)
  docSections.push(
    new Paragraph({
      children: [new TextRun({ text: 'Claims in this Dossier', bold: true, size: 28, color: BRAND.primary, font: 'Calibri' })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    }),
    ...selectedClaims.map((claim, i) =>
      new Paragraph({
        children: [new TextRun({ text: `${i + 1}. ${claim.claim || claim.id}`, size: 20, font: 'Calibri' })],
        spacing: { after: 60 },
        bullet: { level: 0 },
      })
    ),
  );

  // One section per claim
  docSections.push(
    new Paragraph({
      children: [new TextRun({ text: 'Claim Details', bold: true, size: 28, color: BRAND.primary, font: 'Calibri' })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 120 },
      pageBreakBefore: true,
    }),
  );

  for (const claim of selectedClaims) {
    const canonical = claim.canonicalClaimId
      ? index.canonicalById.get(claim.canonicalClaimId) || null
      : null;
    const ingredient = canonical?.activeIngredientId
      ? index.ingredientById.get(canonical.activeIngredientId) || null
      : null;
    const benefitCategory = canonical?.benefitCategoryId
      ? index.benefitCategoryById.get(canonical.benefitCategoryId) || null
      : null;
    const claimPackets = packetsByClaimId.get(claim.id) || [];
    const evidenceItems = claimPackets
      .map(p => p.evidenceItemId ? evidenceById.get(p.evidenceItemId) : null)
      .filter(Boolean);
    const substantiation = computeSubstantiationStatus(evidenceItems, scores);

    const row = {
      claimText: claim.claim || '',
      claimBucket: claim.claimBucket || null,
      ingredient: ingredient ? { name: ingredient.canonicalName || ingredient.name || '' } : null,
      benefitCategory: benefitCategory ? { name: benefitCategory.benefitCategory || benefitCategory.name || '' } : null,
      dose: (() => {
        if (claim.minDoseMg === null && claim.maxDoseMg === null) return null;
        return claim.maxDoseMg && claim.maxDoseMg !== claim.minDoseMg
          ? `${claim.minDoseMg}–${claim.maxDoseMg} mg`
          : `${claim.minDoseMg} mg`;
      })(),
      status: substantiation.status,
      statusInputs: {
        evidenceCount: substantiation.evidenceCount,
        meanScore: substantiation.meanScore,
        scoreCount: substantiation.scoreCount,
      },
    };

    docSections.push(...claimSection(row, evidenceItems, scores));
  }

  // DRAFT watermark repeated at end if draft
  if (isDraft) {
    docSections.push(
      new Paragraph({
        children: [new TextRun({ text: 'DRAFT — PENDING HUMAN REVIEW', bold: true, size: 28, color: BRAND.draftRed, font: 'Calibri' })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
        pageBreakBefore: true,
      }),
    );
  }

  const doc = new Document({
    sections: [{
      properties: {},
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `Nordic Naturals — Substantiation Dossier${isDraft ? ' [DRAFT]' : ''}`,
                  size: 16, color: BRAND.gray, font: 'Calibri',
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `Generated ${now} · Confidential`, size: 16, color: BRAND.gray, font: 'Calibri', italics: true }),
                new TextRun({ text: '\t', font: 'Calibri' }),
                new TextRun({ text: isDraft ? 'DRAFT — NOT FOR DISTRIBUTION' : `Signed off: ${signedOffByName}`, size: 16, color: isDraft ? BRAND.draftRed : BRAND.gray, font: 'Calibri' }),
              ],
              tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            }),
          ],
        }),
      },
      children: docSections,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `substantiation-dossier-${isDraft ? 'DRAFT-' : ''}${Date.now()}.docx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
