/**
 * SQR Applicability — per-(study × claim) external-validity scoring.
 *
 * Separates applicability/directness from bias. A trial can have perfect
 * internal validity (Low RoB 2 across all 5 domains) yet still be
 * inapplicable to a specific Nordic claim — wrong dose, wrong form,
 * wrong population, wrong endpoint. This module scores that gap.
 *
 * Reference:
 *   Zeraatkar 2021, Eur J Nutr 60:2893. DOI: 10.1007/s00394-020-02464-1
 *   Staudacher 2017, Proc Nutr Soc 76:203. PMID: 28629483
 *
 * See the PCS Gap Analysis report section 7.1.4 Layer 3 for the
 * architectural rationale (why bias and applicability must be
 * separate scores in structure-function substantiation).
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';


const P = PROPS.applicability;

// ─── Scoring ─────────────────────────────────────────────────────────────

/**
 * Per-option point values for the 5 ordinal applicability domains.
 * N/A and missing values are excluded from the sum (not scored as 0).
 * This prevents rating a trial as "Low" when a domain genuinely
 * doesn't apply (e.g., Duration N/A for an acute single-dose trial).
 */
const DOMAIN_POINTS = Object.freeze({
  doseMatch: { 'Exact': 2, 'Within 2x': 2, 'Within 10x': 1, 'Outside range': 0 },
  formMatch: { 'Exact match': 2, 'Bioavailability-equivalent': 2, 'Same class different form': 1, 'Different form': 0 },
  durationMatch: { 'Adequate': 2, 'Marginal': 1, 'Insufficient': 0 },
  populationMatch: { 'Exact': 2, 'Close': 1, 'Different': 0 },
  outcomeRelevance: { 'Direct': 2, 'Validated surrogate': 1, 'Indirect': 0 },
});

const MAX_POINTS_PER_DOMAIN = 2;

/**
 * Compute the 0-10 applicability score and High/Moderate/Low/Pending
 * rating from the five ordinal domain selections.
 *
 * Normalized score = 10 × (sum of non-null points) / (number of non-null domains × 2).
 * This handles any-subset-of-N-domains-rated inputs cleanly — a trial
 * with only 3 applicable domains can still score 10/10 if all 3 are
 * top-tier, rather than being capped at 6/10 because two domains
 * legitimately don't apply.
 *
 * Thresholds:
 *   Pending  — no domains rated
 *   Low      — score < 5
 *   Moderate — 5 ≤ score < 8
 *   High     — score ≥ 8
 */
export function computeApplicabilityScore({ doseMatch, formMatch, durationMatch, populationMatch, outcomeRelevance }) {
  const inputs = { doseMatch, formMatch, durationMatch, populationMatch, outcomeRelevance };
  let sum = 0;
  let rated = 0;
  for (const [domain, value] of Object.entries(inputs)) {
    if (!value || value === 'N/A') continue;
    const pts = DOMAIN_POINTS[domain]?.[value];
    if (pts === undefined) continue; // unrecognized value — skip safely
    sum += pts;
    rated += 1;
  }

  if (rated === 0) {
    return { score: null, rating: 'Pending', domainsRated: 0 };
  }

  const normalized = (sum / (rated * MAX_POINTS_PER_DOMAIN)) * 10;
  const rounded = Math.round(normalized * 10) / 10;

  let rating;
  if (rounded >= 8) rating = 'High';
  else if (rounded >= 5) rating = 'Moderate';
  else rating = 'Low';

  return { score: rounded, rating, domainsRated: rated };
}

// ─── Parse / serialize ───────────────────────────────────────────────────

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    name: p[P.name]?.title?.[0]?.plain_text || '',
    evidenceItemId: (p[P.evidenceItem]?.relation || [])[0]?.id || null,
    pcsClaimId: (p[P.pcsClaim]?.relation || [])[0]?.id || null,
    doseMatch: p[P.doseMatch]?.select?.name || null,
    formMatch: p[P.formMatch]?.select?.name || null,
    durationMatch: p[P.durationMatch]?.select?.name || null,
    populationMatch: p[P.populationMatch]?.select?.name || null,
    outcomeRelevance: p[P.outcomeRelevance]?.select?.name || null,
    structuralLimitations: (p[P.structuralLimitations]?.multi_select || []).map(x => x.name),
    applicabilityScore: p[P.applicabilityScore]?.number ?? null,
    applicabilityRating: p[P.applicabilityRating]?.select?.name || null,
    notes: (p[P.notes]?.rich_text || []).map(t => t.plain_text).join(''),
    assessorIds: (p[P.assessor]?.people || []).map(u => u.id),
    assessmentDate: p[P.assessmentDate]?.date?.start || null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

/**
 * Build Notion-shaped property update payload from a fields object.
 * Omits undefined fields so PATCH requests only touch what the caller
 * actually wants to change. Computes applicabilityScore + rating
 * automatically whenever any of the 5 ordinal domains is updated.
 */
function buildProperties(fields, options = {}) {
  const { recomputeScore = true } = options;
  const out = {};

  if (fields.name !== undefined) {
    out[P.name] = { title: [{ text: { content: fields.name || '' } }] };
  }
  if (fields.evidenceItemId !== undefined) {
    out[P.evidenceItem] = fields.evidenceItemId
      ? { relation: [{ id: fields.evidenceItemId }] }
      : { relation: [] };
  }
  if (fields.pcsClaimId !== undefined) {
    out[P.pcsClaim] = fields.pcsClaimId
      ? { relation: [{ id: fields.pcsClaimId }] }
      : { relation: [] };
  }
  if (fields.doseMatch !== undefined) {
    out[P.doseMatch] = fields.doseMatch ? { select: { name: fields.doseMatch } } : { select: null };
  }
  if (fields.formMatch !== undefined) {
    out[P.formMatch] = fields.formMatch ? { select: { name: fields.formMatch } } : { select: null };
  }
  if (fields.durationMatch !== undefined) {
    out[P.durationMatch] = fields.durationMatch ? { select: { name: fields.durationMatch } } : { select: null };
  }
  if (fields.populationMatch !== undefined) {
    out[P.populationMatch] = fields.populationMatch ? { select: { name: fields.populationMatch } } : { select: null };
  }
  if (fields.outcomeRelevance !== undefined) {
    out[P.outcomeRelevance] = fields.outcomeRelevance ? { select: { name: fields.outcomeRelevance } } : { select: null };
  }
  if (fields.structuralLimitations !== undefined) {
    out[P.structuralLimitations] = {
      multi_select: (fields.structuralLimitations || []).map(name => ({ name })),
    };
  }
  if (fields.notes !== undefined) {
    out[P.notes] = { rich_text: [{ text: { content: fields.notes || '' } }] };
  }
  if (fields.assessorIds !== undefined) {
    out[P.assessor] = { people: (fields.assessorIds || []).map(id => ({ id })) };
  }
  if (fields.assessmentDate !== undefined) {
    out[P.assessmentDate] = fields.assessmentDate
      ? { date: { start: fields.assessmentDate } }
      : { date: null };
  }

  // Auto-compute score + rating whenever any of the 5 ordinal domains
  // is touched. The caller can disable via options.recomputeScore=false
  // if they're writing a migrated or imported record with known values.
  const touchedOrdinal = [
    'doseMatch', 'formMatch', 'durationMatch', 'populationMatch', 'outcomeRelevance',
  ].some(k => fields[k] !== undefined);

  if (recomputeScore && touchedOrdinal) {
    const { score, rating } = computeApplicabilityScore({
      doseMatch: fields.doseMatch,
      formMatch: fields.formMatch,
      durationMatch: fields.durationMatch,
      populationMatch: fields.populationMatch,
      outcomeRelevance: fields.outcomeRelevance,
    });
    out[P.applicabilityScore] = { number: score };
    out[P.applicabilityRating] = { select: { name: rating } };
  }

  return out;
}

// ─── CRUD ────────────────────────────────────────────────────────────────

export async function getAllApplicability(maxPages = 50) {
  let all = [];
  let cursor = undefined;
  let pages = 0;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.applicability,
      page_size: 100,
      start_cursor: cursor,
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
    pages += 1;
  } while (cursor && pages < maxPages);
  return all.map(parsePage);
}

export async function getApplicabilityForClaim(claimId) {
  const res = await notion.databases.query({
    database_id: PCS_DB.applicability,
    filter: { property: P.pcsClaim, relation: { contains: claimId } },
  });
  return res.results.map(parsePage);
}

export async function getApplicabilityForEvidence(evidenceItemId) {
  const res = await notion.databases.query({
    database_id: PCS_DB.applicability,
    filter: { property: P.evidenceItem, relation: { contains: evidenceItemId } },
  });
  return res.results.map(parsePage);
}

export async function getApplicabilityById(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function createApplicability(fields) {
  // For POST requests the computed score/rating should always reflect
  // the values being written (not inherit prior state), so we pass all
  // five ordinal fields through buildProperties even when undefined.
  const normalized = {
    ...fields,
    doseMatch: fields.doseMatch ?? null,
    formMatch: fields.formMatch ?? null,
    durationMatch: fields.durationMatch ?? null,
    populationMatch: fields.populationMatch ?? null,
    outcomeRelevance: fields.outcomeRelevance ?? null,
  };
  // Ensure touchedOrdinal fires even if all are null (Pending rating).
  const properties = buildProperties(normalized);
  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.applicability },
    properties,
  });
  return parsePage(page);
}

export async function updateApplicability(id, fields) {
  const properties = buildProperties(fields);
  const page = await notion.pages.update({ page_id: id, properties });
  return parsePage(page);
}

export async function deleteApplicability(id) {
  await notion.pages.update({ page_id: id, archived: true });
}
