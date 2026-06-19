/**
 * POST /api/pcs/export/dossier
 * Capability: pcs.dossier:export  (super-user only until Budget C payment clears)
 *
 * Generates a Substantiation Dossier DOCX for a specific ingredient.
 * Pulls: ingredient metadata, claims linked via canonical claims, evidence.
 *
 * Body: { ingredientId: string, format?: 'docx' }
 *
 * Returns: binary DOCX stream with Content-Disposition attachment header.
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getIngredient } from '@/lib/pcs-ingredients';
import { queryByIngredient } from '@/lib/pcs-explorer';
import { getAllEvidence } from '@/lib/pcs-evidence';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, Header, Footer,
  TabStopPosition, TabStopType,
} from 'docx';

export const dynamic = 'force-dynamic';

// ── DOCX styling constants (matches pcs-docx.js brand) ─────────────────────

const BRAND = {
  primary: '0077B6',
  green: '16A34A',
  yellow: 'CA8A04',
  red: 'DC2626',
  gray: '6B7280',
  lightGray: 'F3F4F6',
};

function titlePage(ingredientName, dateStr) {
  return [
    new Paragraph({ spacing: { before: 3000 } }),
    new Paragraph({
      children: [new TextRun({ text: 'Nordic Naturals', size: 36, color: BRAND.primary, font: 'Calibri', bold: true })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Substantiation Dossier', size: 28, color: BRAND.gray, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 800 },
    }),
    new Paragraph({
      children: [new TextRun({ text: ingredientName, size: 52, bold: true, font: 'Calibri', color: BRAND.primary })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [new TextRun({ text: dateStr, size: 22, color: BRAND.gray, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Nordic Research Platform · Prepared by Regulatory Affairs', size: 18, color: BRAND.gray, font: 'Calibri', italics: true })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: 'CONFIDENTIAL', size: 20, bold: true, color: BRAND.red, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
    }),
  ];
}

function h1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 150 },
  });
}

function h2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: 'Calibri', ...opts })],
    spacing: { after: 100 },
  });
}

function bullet(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: 'Calibri' })],
    bullet: { level: 0 },
    spacing: { after: 60 },
  });
}

function headerCell(text) {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 20, font: 'Calibri', color: BRAND.primary })],
      spacing: { after: 0 },
    })],
    shading: { fill: 'EFF6FF', type: 'clear' },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}

function dataCell(text) {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: text || '—', size: 20, font: 'Calibri' })],
      spacing: { after: 0 },
    })],
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}

function pct(n) { return typeof n === 'number' ? `${Math.round(n)}%` : '—'; }

// ── Main route ──────────────────────────────────────────────────────────────

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.dossier:export', {
    route: '/api/pcs/export/dossier',
  });
  if (auth.error) return auth.error;

  const body_json = await request.json().catch(() => null);
  const { ingredientId } = body_json || {};

  if (!ingredientId) {
    return NextResponse.json({ error: 'ingredientId is required' }, { status: 400 });
  }

  // ── Fetch ingredient data ───────────────────────────────────────────────

  const [ingredient, explorerRows, allEvidence] = await Promise.all([
    getIngredient(ingredientId).catch(() => null),
    queryByIngredient(ingredientId).catch(() => []),
    getAllEvidence().catch(() => []),
  ]);

  if (!ingredient) {
    return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const safeName = (ingredient.canonicalName || ingredient.name || 'ingredient').replace(/[^A-Za-z0-9\- ]/g, '');

  // Build an evidence map for quick lookup
  const evidenceById = new Map(allEvidence.map(e => [e.id, e]));

  // Derive claim status summaries from explorer rows
  const statusCounts = { Supported: 0, Thin: 0, Unsupported: 0, Unknown: 0 };
  for (const row of explorerRows) {
    const s = row.status || 'Unknown';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }
  const totalClaims = explorerRows.length;

  // Unique authority regions
  const allRegions = new Set();
  for (const row of explorerRows) {
    for (const r of row.authorityRegions || []) allRegions.add(r);
  }

  // ── Build DOCX ─────────────────────────────────────────────────────────

  const sections = [];

  // Cover page
  sections.push(...titlePage(ingredient.canonicalName || ingredient.name || 'Ingredient', dateStr));
  sections.push(new Paragraph({ pageBreakBefore: true }));

  // Executive Summary
  sections.push(h1('Executive Summary'));
  sections.push(body(`Ingredient: ${ingredient.canonicalName || ingredient.name || '—'}`, { bold: true }));
  sections.push(body(`Category: ${ingredient.category || '—'}`));
  sections.push(body(`Standard Unit: ${ingredient.standardUnit || '—'}`));
  sections.push(body(`Total Claims: ${totalClaims}`));
  sections.push(body(`Claim Status Breakdown:`));
  sections.push(bullet(`Supported: ${statusCounts.Supported} (${pct(totalClaims > 0 ? (statusCounts.Supported / totalClaims) * 100 : 0)})`));
  sections.push(bullet(`Thin: ${statusCounts.Thin} (${pct(totalClaims > 0 ? (statusCounts.Thin / totalClaims) * 100 : 0)})`));
  sections.push(bullet(`Unsupported: ${statusCounts.Unsupported} (${pct(totalClaims > 0 ? (statusCounts.Unsupported / totalClaims) * 100 : 0)})`));
  if (allRegions.size > 0) {
    sections.push(body(`Authority Regions with Applicable Claims: ${[...allRegions].join(', ')}`));
  }
  if (ingredient.synonyms) {
    sections.push(body(`Synonyms / Common Names: ${ingredient.synonyms}`));
  }
  sections.push(new Paragraph({ pageBreakBefore: true }));

  // Authorized Claims Table
  sections.push(h1('Authorized Claims'));
  sections.push(body('Claims with Supported status, authorized dose thresholds, and applicable regulatory regions.'));
  sections.push(new Paragraph({ spacing: { after: 100 } }));

  if (explorerRows.length === 0) {
    sections.push(body('No claims found for this ingredient. Import PCS documents to populate this section.', { italics: true, color: BRAND.gray }));
  } else {
    const tableRows = [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('Claim Text'),
          headerCell('Status'),
          headerCell('Min Dose'),
          headerCell('Authority Regions'),
          headerCell('Evidence'),
        ],
      }),
      ...explorerRows.map(row => new TableRow({
        children: [
          dataCell(row.claimText || row.claim || '—'),
          dataCell(row.status || '—'),
          dataCell(row.minDoseMg != null ? `${row.minDoseMg} mg` : '—'),
          dataCell((row.authorityRegions || []).join(', ') || '—'),
          dataCell(row.evidenceCount != null ? String(row.evidenceCount) : '—'),
        ],
      })),
    ];

    sections.push(new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
        insideH: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
        insideV: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
      },
    }));
  }

  sections.push(new Paragraph({ pageBreakBefore: true }));

  // Evidence Quality Section
  sections.push(h1('Evidence Quality'));
  sections.push(body(`This section summarizes the clinical evidence supporting each claim, using SQR-RCT scores from Nordic's validated review process.`));
  sections.push(new Paragraph({ spacing: { after: 150 } }));

  const claimsWithEvidence = explorerRows.filter(r => r.evidenceCount > 0);
  if (claimsWithEvidence.length === 0) {
    sections.push(body('No evidence linked to claims yet. Link evidence packets in the Evidence Library.', { italics: true, color: BRAND.gray }));
  } else {
    for (const row of claimsWithEvidence.slice(0, 10)) { // cap at 10 to avoid huge docs
      sections.push(h2(row.claimText || row.claim || 'Claim'));
      if (row.statusInputs?.meanScore != null) {
        sections.push(body(`Mean SQR-RCT Score: ${pct(row.statusInputs.meanScore * 100)} · ${row.evidenceCount || 0} studi${row.evidenceCount !== 1 ? 'es' : 'y'}`));
      } else {
        sections.push(body(`Linked studies: ${row.evidenceCount || 0}`));
      }
      sections.push(new Paragraph({ spacing: { after: 100 } }));
    }
    if (claimsWithEvidence.length > 10) {
      sections.push(body(`… and ${claimsWithEvidence.length - 10} more claims with evidence. See the Evidence Library for full details.`, { italics: true, color: BRAND.gray }));
    }
  }

  sections.push(new Paragraph({ pageBreakBefore: true }));

  // Regional Compliance Overview
  sections.push(h1('Regional Compliance Overview'));
  if (allRegions.size === 0) {
    sections.push(body('No authority regions assessed yet. Use the Claims editor to assign FDA/EFSA/etc. applicability to each claim.', { italics: true, color: BRAND.gray }));
  } else {
    const regionList = [...allRegions];
    sections.push(body('Claims applicable in the following regulatory jurisdictions:'));
    for (const region of regionList) {
      const regionClaims = explorerRows.filter(r => (r.authorityRegions || []).includes(region));
      sections.push(bullet(`${region}: ${regionClaims.length} claim${regionClaims.length !== 1 ? 's' : ''}`));
    }
  }

  sections.push(new Paragraph({ pageBreakBefore: true }));

  // Reviewer sign-off block
  sections.push(h1('Regulatory Affairs Sign-Off'));
  sections.push(body('This document has been prepared by the Nordic Research Platform and reviewed by Regulatory Affairs.'));
  sections.push(new Paragraph({ spacing: { after: 400 } }));
  sections.push(body('Reviewed by: _______________________________'));
  sections.push(body('Title: Regulatory Affairs'));
  sections.push(new Paragraph({ spacing: { after: 200 } }));
  sections.push(body('Date: _______________________________'));
  sections.push(new Paragraph({ spacing: { after: 200 } }));
  sections.push(body('Version: 1.0 (initial dossier)', { italics: true, color: BRAND.gray }));

  // ── Assemble & stream ─────────────────────────────────────────────────

  const doc = new Document({
    sections: [{ children: sections }],
    creator: 'Nordic Research Platform',
    title: `Substantiation Dossier — ${ingredient.canonicalName || ingredient.name}`,
    description: `Generated ${dateStr} for Regulatory Affairs filing`,
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `Substantiation-Dossier-${safeName.replace(/\s+/g, '-')}-${dateStr}.docx`;

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    },
  });
}
