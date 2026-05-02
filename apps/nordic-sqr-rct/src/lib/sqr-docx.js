/**
 * SQR-RCT Assisted-Review Word Export
 *
 * Generates a Word (.docx) report for a single study assessment in
 * Sharon's reference Cochrane RoB 2 format (Deshpande 2020 / Salve 2019),
 * extended with Nordic's:
 *   • per-domain RoB 2 judgments + rationale (rob2-mapping.js)
 *   • per-claim applicability rollup (applicability.js)
 *   • per-claim NutriGrade certainty rollup (nutrigrade.js)
 *   • raw SQR-RCT scores per item
 *
 * Reuses the autoTable / branded helpers from pcs-docx.js patterns
 * (content-aware column widths, brand color palette).
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, ShadingType,
  PageBreak, Header, Footer, TabStopPosition, TabStopType,
} from 'docx';

import { mapRubricToRoB2 } from './rob2-mapping.js';

const BRAND = {
  primary: '0077B6',  // Nordic blue
  green: '16A34A',
  yellow: 'CA8A04',
  red: 'DC2626',
  gray: '6B7280',
  lightGray: 'F3F4F6',
  white: 'FFFFFF',
};

// Cochrane RoB 2 traffic-light symbols (text-based — no emoji
// dependency). Sharon's reference docs use the green/yellow/red dot
// glyphs in a separate column; we use unicode equivalents.
const JUDGMENT_GLYPH = {
  'Low': '+',
  'Some concerns': '!',
  'High': 'X',
};
const JUDGMENT_COLOR = {
  'Low': BRAND.green,
  'Some concerns': BRAND.yellow,
  'High': BRAND.red,
};
const RATING_COLOR = {
  'High': BRAND.green,
  'Moderate': BRAND.yellow,
  'Low': BRAND.red,
  'Very Low': BRAND.red,
  'Pending': BRAND.gray,
};

// ─────────────────────────────────────────────
// Shared helpers (mirrors pcs-docx.js)
// ─────────────────────────────────────────────

function headerFooter(title) {
  return {
    default: {
      header: new Header({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: 'Nordic Naturals — SQR-RCT Assisted Review', size: 16, color: BRAND.gray, font: 'Calibri' }),
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
  const { bold, color, shading, width, alignment, italics, size } = opts;
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: String(text ?? '—'), size: size || 20, font: 'Calibri', bold, color, italics })],
        alignment: alignment || AlignmentType.LEFT,
        spacing: { after: 0 },
      }),
    ],
    width: width ? { size: width * 50, type: WidthType.PERCENTAGE } : undefined,
    shading: shading ? { type: ShadingType.SOLID, color: shading } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
  });
}

function headerCell(text, width) {
  return cell(text, { bold: true, color: BRAND.white, shading: BRAND.primary, width });
}

function tableRow(cells) {
  return new TableRow({ children: cells });
}

function autoWidths(headers, dataRows, opts = {}) {
  const { minWidth = 6, maxWeight = 60 } = opts;
  const colCount = headers.length;
  const maxLens = headers.map(h => String(h).length);
  for (const row of dataRows) {
    for (let i = 0; i < colCount; i++) {
      const len = String(row[i] ?? '').length;
      if (len > maxLens[i]) maxLens[i] = len;
    }
  }
  const weights = maxLens.map(len => Math.min(len, maxWeight));
  const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;
  let widths = weights.map(w => Math.max(minWidth, Math.round((w / totalWeight) * 100)));
  const sum = widths.reduce((s, w) => s + w, 0);
  if (sum !== 100) {
    const maxIdx = widths.indexOf(Math.max(...widths));
    widths[maxIdx] += 100 - sum;
  }
  return widths;
}

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
// Title block
// ─────────────────────────────────────────────

function titleBlock(citation, doi, journal, year) {
  return [
    new Paragraph({ spacing: { before: 1500 } }),
    new Paragraph({
      children: [new TextRun({ text: 'Nordic Naturals', size: 28, color: BRAND.primary, font: 'Calibri', bold: true })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: 'SQR-RCT Assisted Review', size: 22, color: BRAND.gray, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Cochrane RoB 2 Domain Assessment', size: 32, bold: true, font: 'Calibri', color: BRAND.primary })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: citation || 'Untitled study', size: 24, italics: true, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: [journal, year].filter(Boolean).join(' — '), size: 22, color: BRAND.gray, font: 'Calibri' }),
      ],
      alignment: AlignmentType.CENTER,
    }),
    doi
      ? new Paragraph({
          children: [new TextRun({ text: `DOI: ${doi}`, size: 20, color: BRAND.gray, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
        })
      : new Paragraph({}),
    new Paragraph({
      children: [new TextRun({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), size: 20, color: BRAND.gray, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
    }),
  ];
}

// ─────────────────────────────────────────────
// RoB 2 per-domain section (Sharon's reference format)
// ─────────────────────────────────────────────

const DOMAIN_DEFINITIONS = [
  {
    key: 'd1',
    title: 'Domain 1: Risk of bias arising from the randomization process',
    signallingItems: ['Q2 Randomization', 'Q5 Baseline Characteristics'],
  },
  {
    key: 'd2',
    title: 'Domain 2: Risk of bias due to deviations from intended interventions',
    signallingItems: ['Q3 Blinding', 'Q7 Intervention Description', 'Q6 Participant Flow'],
  },
  {
    key: 'd3',
    title: 'Domain 3: Risk of bias due to missing outcome data',
    signallingItems: ['Q6 Participant Flow', 'Q9 Statistical Analysis'],
  },
  {
    key: 'd4',
    title: 'Domain 4: Risk of bias in measurement of the outcome',
    signallingItems: ['Q8 Outcome Measurement', 'Q3 Blinding'],
  },
  {
    key: 'd5',
    title: 'Domain 5: Risk of bias in selection of the reported result',
    signallingItems: ['Q10 Bias Assessment', 'Q12 Trial Registration (V3 only)'],
  },
];

function domainSection(domainDef, domainResult, score) {
  const judgment = domainResult.judgment;
  const glyph = JUDGMENT_GLYPH[judgment] || '?';
  const color = JUDGMENT_COLOR[judgment] || BRAND.gray;

  const rationaleRows = (domainResult.rationale || []).map((r, i) => ({
    texts: [String(i + 1), r],
    opts: [{ alignment: AlignmentType.CENTER }, null],
  }));

  return [
    heading(domainDef.title, HeadingLevel.HEADING_2),
    autoTable(
      ['Field', 'Value'],
      [
        { texts: ['Signalling questions consulted', domainDef.signallingItems.join('; ')] },
        {
          texts: [`Risk-of-bias judgment  [${glyph}]`, judgment],
          opts: [null, { bold: true, color }],
        },
      ],
    ),
    new Paragraph({ spacing: { after: 100 } }),
    bodyText('Rationale:', { bold: true }),
    rationaleRows.length > 0
      ? autoTable(['#', 'Reasoning'], rationaleRows)
      : bodyText('(no rationale recorded)', { italics: true, color: BRAND.gray }),
    new Paragraph({ spacing: { after: 200 } }),
  ];
}

// ─────────────────────────────────────────────
// Raw SQR-RCT scores table
// ─────────────────────────────────────────────

const RUBRIC_LABELS = {
  q1: 'Q1 Research Question',
  q2: 'Q2 Randomization',
  q3: 'Q3 Blinding',
  q4: 'Q4 Sample Size',
  q5: 'Q5 Baseline Characteristics',
  q6: 'Q6 Participant Flow',
  q7: 'Q7 Intervention Description',
  q8: 'Q8 Outcome Measurement',
  q9: 'Q9 Statistical Analysis',
  q10: 'Q10 Bias Assessment',
  q11: 'Q11 Applicability',
  q12: 'Q12 Trial Registration',
};

function rawScoresTable(score) {
  const rows = [];
  for (let i = 1; i <= 12; i++) {
    const key = `q${i}`;
    const v = score[key];
    if (v === undefined || v === null) continue;
    const tier = v === 2 ? 'High' : v === 1 ? 'Moderate' : 'Low';
    const tierColor = v === 2 ? BRAND.green : v === 1 ? BRAND.yellow : BRAND.red;
    rows.push({
      texts: [RUBRIC_LABELS[key] || key, String(v), tier, score[`${key}Raw`] || ''],
      opts: [
        { bold: true },
        { alignment: AlignmentType.CENTER, bold: true },
        { color: tierColor, bold: true, alignment: AlignmentType.CENTER },
        { italics: true, color: BRAND.gray, size: 18 },
      ],
    });
  }
  return autoTable(['Rubric Item', 'Score', 'Tier', 'Selected response'], rows);
}

// ─────────────────────────────────────────────
// Domain summary table (Sharon's reference: judgment + emoji indicator)
// ─────────────────────────────────────────────

function domainSummaryTable(rob2) {
  const domains = [
    { def: DOMAIN_DEFINITIONS[0], r: rob2.d1 },
    { def: DOMAIN_DEFINITIONS[1], r: rob2.d2 },
    { def: DOMAIN_DEFINITIONS[2], r: rob2.d3 },
    { def: DOMAIN_DEFINITIONS[3], r: rob2.d4 },
    { def: DOMAIN_DEFINITIONS[4], r: rob2.d5 },
  ];
  const rows = domains.map(({ def, r }) => {
    const j = r.judgment;
    return {
      texts: [def.title.replace(/^Domain \d+: /, ''), `[${JUDGMENT_GLYPH[j] || '?'}]`, j],
      opts: [
        null,
        { alignment: AlignmentType.CENTER, bold: true, color: JUDGMENT_COLOR[j] || BRAND.gray },
        { bold: true, color: JUDGMENT_COLOR[j] || BRAND.gray },
      ],
    };
  });
  // Append overall row
  const o = rob2.overall;
  rows.push({
    texts: ['OVERALL JUDGMENT (worst-domain-wins)', `[${JUDGMENT_GLYPH[o] || '?'}]`, o],
    opts: [
      { bold: true },
      { alignment: AlignmentType.CENTER, bold: true, color: JUDGMENT_COLOR[o] || BRAND.gray },
      { bold: true, color: JUDGMENT_COLOR[o] || BRAND.gray },
    ],
  });
  return autoTable(['Domain', 'Indicator', 'Judgment'], rows);
}

// ─────────────────────────────────────────────
// Applicability + Certainty (when claim attached)
// ─────────────────────────────────────────────

function applicabilitySection(applicabilityRecords) {
  if (!applicabilityRecords || applicabilityRecords.length === 0) {
    return [bodyText('No applicability assessments are linked to this study.', { italics: true, color: BRAND.gray })];
  }
  const rows = applicabilityRecords.map(a => ({
    texts: [
      a.name || '—',
      a.doseMatch || '—',
      a.formMatch || '—',
      a.durationMatch || '—',
      a.populationMatch || '—',
      a.outcomeRelevance || '—',
      a.applicabilityScore != null ? a.applicabilityScore.toFixed(1) : '—',
      a.applicabilityRating || 'Pending',
    ],
    opts: [null, null, null, null, null, null,
      { alignment: AlignmentType.CENTER, bold: true },
      { bold: true, color: RATING_COLOR[a.applicabilityRating] || BRAND.gray, alignment: AlignmentType.CENTER },
    ],
  }));
  return [
    autoTable(
      ['Assessment', 'Dose', 'Form', 'Duration', 'Population', 'Outcome', 'Score / 10', 'Rating'],
      rows,
    ),
  ];
}

function certaintySection(certaintyRecords) {
  if (!certaintyRecords || certaintyRecords.length === 0) {
    return [bodyText('No NutriGrade certainty rollup is available for the claim(s) this study supports.', { italics: true, color: BRAND.gray })];
  }
  const out = [];
  for (const rec of certaintyRecords) {
    const c = rec.certainty;
    out.push(
      heading(rec.claimLabel || 'Claim', HeadingLevel.HEADING_3),
      autoTable(
        ['Field', 'Value'],
        [
          { texts: ['Evidence count', String(rec.derivedInputs?.evidenceCount ?? '—')] },
          { texts: ['Mean SQR (0–22)', rec.derivedInputs?.sqrMean != null ? rec.derivedInputs.sqrMean.toFixed(1) : '—'] },
          { texts: ['Mean Applicability (0–10)', rec.derivedInputs?.applicabilityMean != null ? rec.derivedInputs.applicabilityMean.toFixed(1) : '—'] },
          {
            texts: ['Certainty score (0–10)', c.score != null ? c.score.toFixed(1) : '—'],
            opts: [null, { bold: true }],
          },
          {
            texts: ['Certainty rating', c.rating],
            opts: [null, { bold: true, color: RATING_COLOR[c.rating] || BRAND.gray }],
          },
        ],
      ),
      new Paragraph({ spacing: { after: 100 } }),
      bodyText('Breakdown:', { bold: true }),
    );
    const breakdownRows = (c.breakdown || []).map(b => ({
      texts: [b.label, `${b.pts}${b.max ? ` / ${b.max}` : ''}`, b.note || ''],
      opts: [null, { alignment: AlignmentType.CENTER }, { italics: true, color: BRAND.gray, size: 18 }],
    }));
    out.push(
      autoTable(['Component', 'Points', 'Note'], breakdownRows),
      new Paragraph({ spacing: { after: 200 } }),
    );
  }
  return out;
}

// ─────────────────────────────────────────────
// Key Takeaway narrative
// ─────────────────────────────────────────────

function buildKeyTakeaway({ citation, rob2, totalScore, qualityTier, applicabilityRecords, certaintyRecords }) {
  const overall = rob2.overall;
  const highDomains = ['d1', 'd2', 'd3', 'd4', 'd5']
    .filter(k => rob2[k].judgment === 'High')
    .map(k => rob2[k].name);
  const someDomains = ['d1', 'd2', 'd3', 'd4', 'd5']
    .filter(k => rob2[k].judgment === 'Some concerns')
    .map(k => rob2[k].name);

  const author = (citation || '').split(',')[0] || 'This study';

  const sentences = [];

  // Sentence 1: Overall RoB + SQR
  let s1 = `${author} received an overall Cochrane RoB 2 judgment of ${overall.toUpperCase()} (worst-domain-wins) and an SQR-RCT total score of ${totalScore}/22 (${qualityTier}).`;
  sentences.push(s1);

  // Sentence 2: Driver domains
  if (overall === 'High' && highDomains.length > 0) {
    sentences.push(`The high-risk judgment is driven by ${highDomains.join(', ')}.`);
  } else if (overall === 'Some concerns' && someDomains.length > 0) {
    sentences.push(`Areas of concern: ${someDomains.join(', ')}.`);
  } else if (overall === 'Low') {
    sentences.push('All five RoB 2 domains were judged Low risk.');
  }

  // Sentence 3: Applicability + certainty rollup
  const applPieces = [];
  if (applicabilityRecords && applicabilityRecords.length > 0) {
    const rated = applicabilityRecords.filter(a => a.applicabilityRating && a.applicabilityRating !== 'Pending');
    if (rated.length > 0) {
      const ratings = rated.map(a => a.applicabilityRating);
      const mode = ratings.sort((a, b) =>
        ratings.filter(v => v === a).length - ratings.filter(v => v === b).length,
      ).pop();
      applPieces.push(`applicability across ${rated.length} linked claim assessment(s) is predominantly ${mode}`);
    }
  }
  if (certaintyRecords && certaintyRecords.length > 0) {
    const ratings = certaintyRecords.map(r => r.certainty?.rating).filter(Boolean);
    if (ratings.length > 0) {
      applPieces.push(`NutriGrade body-of-evidence certainty for the linked claim(s): ${ratings.join(', ')}`);
    }
  }
  if (applPieces.length > 0) {
    sentences.push(`In context, ${applPieces.join('; ')}.`);
  } else {
    sentences.push('No PCS claim, applicability, or NutriGrade certainty data is currently linked to this study.');
  }

  return sentences.join(' ');
}

// ─────────────────────────────────────────────
// Main report generator
// ─────────────────────────────────────────────

/**
 * Generate the full SQR-RCT assisted-review Word document.
 *
 * @param {Object} input
 * @param {Object} input.score - parsed score record (q1..q12 numeric, qNRaw strings, rubricVersion, raterAlias, etc.)
 * @param {Object} input.study - parsed intake/study record (citation, doi, journal, year, etc.)
 * @param {Array}  input.applicability - applicability records linked to the study (optional)
 * @param {Array}  input.certainty - per-claim certainty records [{ claimLabel, certainty, derivedInputs }] (optional)
 * @returns {Document}
 */
export function generateAssistedReviewDoc({ score, study, applicability = [], certainty = [] }) {
  // Build numeric scores object for rob2 mapping
  const rob2Input = {};
  for (let i = 1; i <= 12; i++) {
    const v = score[`q${i}`];
    if (v === 0 || v === 1 || v === 2) rob2Input[`q${i}`] = v;
  }
  const rob2 = mapRubricToRoB2(rob2Input);

  const totalScore = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].reduce(
    (s, i) => s + (typeof score[`q${i}`] === 'number' ? score[`q${i}`] : 0), 0,
  );
  const qualityTier =
    totalScore >= 17 ? 'High Quality' :
    totalScore >= 11 ? 'Moderate Quality' : 'Low Quality';

  const sections = [
    ...titleBlock(study?.citation, study?.doi, study?.journal, study?.year),
    new Paragraph({ children: [new PageBreak()] }),

    // 1. Preliminary considerations
    heading('Preliminary Considerations', HeadingLevel.HEADING_1),
    autoTable(
      ['Field', 'Value'],
      [
        { texts: ['Citation', study?.citation || '—'] },
        { texts: ['DOI', study?.doi || '—'] },
        { texts: ['Journal', study?.journal || '—'] },
        { texts: ['Year', study?.year ? String(study.year) : '—'] },
        { texts: ['Study design', study?.studyDesign || '—'] },
        { texts: ['Funding source(s)', study?.fundingSources || '—'] },
        { texts: ['Initial N / Final N', `${study?.initialN ?? '—'} / ${study?.finalN ?? '—'}`] },
        { texts: ['Blinding (intake)', study?.blinding || '—'] },
        { texts: ['A priori power', study?.aPrioriPower || '—'] },
        { texts: ['Primary outcomes', study?.dependentVariables || '—'] },
        { texts: ['Reviewer', score.raterAlias || '—'] },
        { texts: ['Rubric version', score.rubricVersion || '—'] },
        { texts: ['Reviewed on', score.timestamp ? new Date(score.timestamp).toLocaleString('en-US') : '—'] },
      ],
    ),
    new Paragraph({ spacing: { after: 300 } }),

    // 2. Per-domain RoB 2 sections
    heading('Cochrane RoB 2 — Domain-by-Domain Assessment', HeadingLevel.HEADING_1),
    bodyText(
      'Each domain judgment is derived deterministically from the Nordic SQR-RCT 11-item rubric scores via the mapping documented in src/lib/rob2-mapping.js. Indicators: [+] Low risk, [!] Some concerns, [X] High risk.',
      { italics: true, color: BRAND.gray },
    ),
    new Paragraph({ spacing: { after: 200 } }),
    ...domainSection(DOMAIN_DEFINITIONS[0], rob2.d1, score),
    ...domainSection(DOMAIN_DEFINITIONS[1], rob2.d2, score),
    ...domainSection(DOMAIN_DEFINITIONS[2], rob2.d3, score),
    ...domainSection(DOMAIN_DEFINITIONS[3], rob2.d4, score),
    ...domainSection(DOMAIN_DEFINITIONS[4], rob2.d5, score),

    // 3. Domain judgment summary (one-page overview)
    new Paragraph({ children: [new PageBreak()] }),
    heading('Domain Judgment Summary', HeadingLevel.HEADING_1),
    domainSummaryTable(rob2),
    new Paragraph({ spacing: { after: 100 } }),
    bodyText(`Algorithm: ${rob2.algorithm}`, { italics: true, color: BRAND.gray, size: 18 }),
    new Paragraph({ spacing: { after: 300 } }),

    // 4. Overall judgment
    heading('Overall Risk-of-Bias Judgment', HeadingLevel.HEADING_1),
    new Paragraph({
      children: [
        new TextRun({ text: `Overall: `, size: 28, font: 'Calibri', bold: true }),
        new TextRun({ text: rob2.overall, size: 28, font: 'Calibri', bold: true, color: JUDGMENT_COLOR[rob2.overall] || BRAND.gray }),
      ],
      spacing: { after: 120 },
    }),
    bodyText(
      'Per RoB 2 Full Guidance §4.2, the overall judgment for a specific outcome is the worst of the five domain judgments.',
      { italics: true, color: BRAND.gray },
    ),
    new Paragraph({ spacing: { after: 300 } }),

    // 5. Raw SQR-RCT scores
    heading('Raw SQR-RCT Rubric Scores', HeadingLevel.HEADING_1),
    bodyText(
      `Total: ${totalScore}/22 — ${qualityTier} (Nordic thresholds: High ≥17, Moderate 11–16, Low <11). The 0/1/2 ordinal scores below feed the RoB 2 mapping above.`,
      { italics: true, color: BRAND.gray },
    ),
    new Paragraph({ spacing: { after: 100 } }),
    rawScoresTable(score),
    new Paragraph({ spacing: { after: 300 } }),

    // 6. Applicability rollup
    heading('Per-Claim Applicability (Layer 3 — Directness)', HeadingLevel.HEADING_1),
    bodyText(
      'Applicability is scored separately from bias to avoid penalizing structurally-appropriate healthy-population trials. See src/lib/applicability.js for the 5-domain rollup.',
      { italics: true, color: BRAND.gray },
    ),
    new Paragraph({ spacing: { after: 100 } }),
    ...applicabilitySection(applicability),
    new Paragraph({ spacing: { after: 300 } }),

    // 7. Certainty rollup
    heading('NutriGrade Body-of-Evidence Certainty (Layer 4)', HeadingLevel.HEADING_1),
    bodyText(
      'Certainty rollup follows Schwingshackl 2016 (Adv Nutr 7:994); single-study claims are capped at Low. See src/lib/nutrigrade.js for the deterministic rollup.',
      { italics: true, color: BRAND.gray },
    ),
    new Paragraph({ spacing: { after: 100 } }),
    ...certaintySection(certainty),
    new Paragraph({ spacing: { after: 300 } }),

    // 8. Key takeaway
    new Paragraph({ children: [new PageBreak()] }),
    heading('Key Takeaway', HeadingLevel.HEADING_1),
    bodyText(buildKeyTakeaway({
      citation: study?.citation,
      rob2,
      totalScore,
      qualityTier,
      applicabilityRecords: applicability,
      certaintyRecords: certainty,
    })),

    // 9. Reviewer notes
    score.notes
      ? heading('Reviewer Notes', HeadingLevel.HEADING_1)
      : new Paragraph({}),
    score.notes ? bodyText(score.notes) : new Paragraph({}),

    new Paragraph({ spacing: { after: 200 } }),
    bodyText(
      'This report was generated by the Nordic SQR-RCT platform from the structured rubric scores submitted by the named reviewer. The Cochrane RoB 2 judgments are a deterministic projection — see src/lib/rob2-mapping.js for the full mapping rules and rationale.',
      { italics: true, color: BRAND.gray, size: 18 },
    ),
  ];

  return new Document({
    sections: [{
      headers: { default: headerFooter('SQR Assisted Review').default.header },
      footers: { default: headerFooter('SQR Assisted Review').default.footer },
      children: sections,
    }],
  });
}

/**
 * Compute a friendly filename from the study citation.
 * Pattern: {Author}-{Year}-SQR-Review-{date}.docx
 */
export function buildFilename(study) {
  const citation = study?.citation || '';
  // Try "Author et al. (YYYY)" or "Author, F. (YYYY)" formats
  const authorMatch = citation.match(/^([A-Za-z][A-Za-z\-']+)/);
  const author = authorMatch ? authorMatch[1] : 'Study';
  const year = study?.year || (citation.match(/\((\d{4})\)/) || [])[1] || 'NA';
  const date = new Date().toISOString().split('T')[0];
  return `${author}-${year}-SQR-Review-${date}.docx`;
}

export async function packDocument(doc) {
  return Packer.toBuffer(doc);
}
