/**
 * SQR Applicability — per-(study × claim) external-validity scoring.
 *
 * Part 10 / Tier-1 PR #4 (2026-05-23): rewritten Postgres-first. Reads
 * and writes target `pcs_applicability` (migration 013). Notion is no
 * longer canonical; mirror writes are fire-and-forget so legacy Notion
 * views drift loosely but never block the platform request path.
 *
 * Separates applicability/directness from bias. A trial can have perfect
 * internal validity (Low RoB 2 across all 5 domains) yet still be
 * inapplicable to a specific Nordic claim — wrong dose, wrong form,
 * wrong population, wrong endpoint. This module scores that gap.
 *
 * Reference:
 *   Zeraatkar 2021, Eur J Nutr 60:2893. DOI: 10.1007/s00394-020-02464-1
 *   Staudacher 2017, Proc Nutr Soc 76:203. PMID: 28629483
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';
import { getPcsSupabase } from './supabase-pcs.js';

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
 */
export function computeApplicabilityScore({ doseMatch, formMatch, durationMatch, populationMatch, outcomeRelevance }) {
  const inputs = { doseMatch, formMatch, durationMatch, populationMatch, outcomeRelevance };
  let sum = 0;
  let rated = 0;
  for (const [domain, value] of Object.entries(inputs)) {
    if (!value || value === 'N/A') continue;
    const pts = DOMAIN_POINTS[domain]?.[value];
    if (pts === undefined) continue;
    sum += pts;
    rated += 1;
  }

  if (rated === 0) return { score: null, rating: 'Pending', domainsRated: 0 };

  const normalized = (sum / (rated * MAX_POINTS_PER_DOMAIN)) * 10;
  const rounded = Math.round(normalized * 10) / 10;

  let rating;
  if (rounded >= 8) rating = 'High';
  else if (rounded >= 5) rating = 'Moderate';
  else rating = 'Low';

  return { score: rounded, rating, domainsRated: rated };
}

// ─── Parse ───────────────────────────────────────────────────────────────

/** Map a pcs_applicability row → public shape. */
function parsePostgresRow(row) {
  return {
    id: row.notion_page_id || row.id,
    name: row.name || '',
    evidenceItemId: row.evidence_item_id || null,
    pcsClaimId: row.pcs_claim_id || null,
    doseMatch: row.dose_match || null,
    formMatch: row.form_match || null,
    durationMatch: row.duration_match || null,
    populationMatch: row.population_match || null,
    outcomeRelevance: row.outcome_relevance || null,
    structuralLimitations: row.structural_limitations || [],
    applicabilityScore: row.applicability_score ?? null,
    applicabilityRating: row.applicability_rating || null,
    notes: row.notes || '',
    assessorIds: row.assessor_ids || [],
    assessmentDate: row.assessment_date || null,
    createdTime: row.notion_created_at || null,
    lastEditedTime: row.notion_last_edited_at || null,
  };
}

/** Map a Notion page → public shape (kept for the legacy fallback path). */
function parseNotionPage(page) {
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

// ─── Row builder (camelCase fields → snake_case columns) ─────────────────

/**
 * Build a pcs_applicability row from a fields object. Auto-computes
 * applicability_score + applicability_rating whenever any of the 5
 * ordinal domains is touched.
 */
function buildRow(fields, { recomputeScore = true } = {}) {
  const row = {};
  if (fields.name !== undefined) row.name = fields.name || '';
  if (fields.evidenceItemId !== undefined) row.evidence_item_id = fields.evidenceItemId || null;
  if (fields.pcsClaimId !== undefined) row.pcs_claim_id = fields.pcsClaimId || null;
  if (fields.doseMatch !== undefined) row.dose_match = fields.doseMatch || null;
  if (fields.formMatch !== undefined) row.form_match = fields.formMatch || null;
  if (fields.durationMatch !== undefined) row.duration_match = fields.durationMatch || null;
  if (fields.populationMatch !== undefined) row.population_match = fields.populationMatch || null;
  if (fields.outcomeRelevance !== undefined) row.outcome_relevance = fields.outcomeRelevance || null;
  if (fields.structuralLimitations !== undefined) row.structural_limitations = fields.structuralLimitations || [];
  if (fields.notes !== undefined) row.notes = fields.notes || '';
  if (fields.assessorIds !== undefined) row.assessor_ids = fields.assessorIds || [];
  if (fields.assessmentDate !== undefined) row.assessment_date = fields.assessmentDate || null;

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
    row.applicability_score = score;
    row.applicability_rating = rating;
  }

  return row;
}

/** Build Notion-shaped properties (legacy mirror only). */
function buildProperties(fields, options = {}) {
  const { recomputeScore = true } = options;
  const out = {};
  if (fields.name !== undefined) out[P.name] = { title: [{ text: { content: fields.name || '' } }] };
  if (fields.evidenceItemId !== undefined) out[P.evidenceItem] = fields.evidenceItemId ? { relation: [{ id: fields.evidenceItemId }] } : { relation: [] };
  if (fields.pcsClaimId !== undefined) out[P.pcsClaim] = fields.pcsClaimId ? { relation: [{ id: fields.pcsClaimId }] } : { relation: [] };
  if (fields.doseMatch !== undefined) out[P.doseMatch] = fields.doseMatch ? { select: { name: fields.doseMatch } } : { select: null };
  if (fields.formMatch !== undefined) out[P.formMatch] = fields.formMatch ? { select: { name: fields.formMatch } } : { select: null };
  if (fields.durationMatch !== undefined) out[P.durationMatch] = fields.durationMatch ? { select: { name: fields.durationMatch } } : { select: null };
  if (fields.populationMatch !== undefined) out[P.populationMatch] = fields.populationMatch ? { select: { name: fields.populationMatch } } : { select: null };
  if (fields.outcomeRelevance !== undefined) out[P.outcomeRelevance] = fields.outcomeRelevance ? { select: { name: fields.outcomeRelevance } } : { select: null };
  if (fields.structuralLimitations !== undefined) out[P.structuralLimitations] = { multi_select: (fields.structuralLimitations || []).map(name => ({ name })) };
  if (fields.notes !== undefined) out[P.notes] = { rich_text: [{ text: { content: fields.notes || '' } }] };
  if (fields.assessorIds !== undefined) out[P.assessor] = { people: (fields.assessorIds || []).map(id => ({ id })) };
  if (fields.assessmentDate !== undefined) out[P.assessmentDate] = fields.assessmentDate ? { date: { start: fields.assessmentDate } } : { date: null };

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

// ─── Reads ───────────────────────────────────────────────────────────────

export async function getAllApplicability(maxPages = 50) {
  const sb = getPcsSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('pcs_applicability')
      .select('*')
      .order('notion_last_edited_at', { ascending: false, nullsFirst: false })
      .limit(maxPages * 100);
    if (!error) return (data || []).map(parsePostgresRow);
    console.warn('[applicability] Postgres read failed, falling back to Notion:', error.message);
  }
  // Notion fallback (kept for resilience; rarely exercised post-Part-10).
  let all = [];
  let cursor;
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
  return all.map(parseNotionPage);
}

export async function getApplicabilityForClaim(claimId) {
  const sb = getPcsSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('pcs_applicability')
      .select('*')
      .eq('pcs_claim_id', claimId);
    if (!error) return (data || []).map(parsePostgresRow);
  }
  const res = await notion.databases.query({
    database_id: PCS_DB.applicability,
    filter: { property: P.pcsClaim, relation: { contains: claimId } },
  });
  return res.results.map(parseNotionPage);
}

export async function getApplicabilityForEvidence(evidenceItemId) {
  const sb = getPcsSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('pcs_applicability')
      .select('*')
      .eq('evidence_item_id', evidenceItemId);
    if (!error) return (data || []).map(parsePostgresRow);
  }
  const res = await notion.databases.query({
    database_id: PCS_DB.applicability,
    filter: { property: P.evidenceItem, relation: { contains: evidenceItemId } },
  });
  return res.results.map(parseNotionPage);
}

export async function getApplicabilityById(id) {
  const sb = getPcsSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('pcs_applicability')
      .select('*')
      .eq('notion_page_id', id)
      .maybeSingle();
    if (!error && data) return parsePostgresRow(data);
  }
  const page = await notion.pages.retrieve({ page_id: id });
  return parseNotionPage(page);
}

// ─── Writes — Postgres canonical, Notion mirror fire-and-forget ──────────

export async function createApplicability(fields) {
  // Score should reflect all five ordinal fields even when null (Pending).
  const normalized = {
    ...fields,
    doseMatch: fields.doseMatch ?? null,
    formMatch: fields.formMatch ?? null,
    durationMatch: fields.durationMatch ?? null,
    populationMatch: fields.populationMatch ?? null,
    outcomeRelevance: fields.outcomeRelevance ?? null,
  };
  const row = buildRow(normalized);
  // Pre-allocate the canonical ID so Postgres + Notion agree on it.
  const newId = crypto.randomUUID();
  row.notion_page_id = newId;
  row.notion_created_at = new Date().toISOString();
  row.notion_last_edited_at = row.notion_created_at;

  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');

  const { data, error } = await sb
    .from('pcs_applicability')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`Applicability insert failed: ${error.message}`);

  // Notion mirror — fire-and-forget; do not block on Notion API.
  notion.pages
    .create({ parent: { database_id: PCS_DB.applicability }, properties: buildProperties(normalized) })
    .catch(() => { /* Part 10 — Notion no longer canonical */ });

  return parsePostgresRow(data);
}

export async function updateApplicability(id, fields) {
  const row = buildRow(fields);
  row.notion_last_edited_at = new Date().toISOString();

  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');

  const { data, error } = await sb
    .from('pcs_applicability')
    .update(row)
    .eq('notion_page_id', id)
    .select('*')
    .single();
  if (error) throw new Error(`Applicability update failed: ${error.message}`);

  notion.pages
    .update({ page_id: id, properties: buildProperties(fields) })
    .catch(() => { /* Part 10 — Notion no longer canonical */ });

  return parsePostgresRow(data);
}

export async function deleteApplicability(id) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');

  const { error } = await sb
    .from('pcs_applicability')
    .delete()
    .eq('notion_page_id', id);
  if (error) throw new Error(`Applicability delete failed: ${error.message}`);

  // Mirror archive into Notion (legacy).
  notion.pages
    .update({ page_id: id, archived: true })
    .catch(() => { /* Part 10 — Notion no longer canonical */ });
}
