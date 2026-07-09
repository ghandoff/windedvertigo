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

import { getPcsSupabase } from './supabase-pcs.js';

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

// ─── Reads ───────────────────────────────────────────────────────────────

export async function getAllApplicability(maxPages = 50) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('pcs_applicability')
    .select('*')
    .order('notion_last_edited_at', { ascending: false, nullsFirst: false })
    .limit(maxPages * 100);
  if (error) throw new Error(`Applicability read failed: ${error.message}`);
  return (data || []).map(parsePostgresRow);
}

export async function getApplicabilityForClaim(claimId) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('pcs_applicability')
    .select('*')
    .eq('pcs_claim_id', claimId);
  if (error) throw new Error(`Applicability read failed: ${error.message}`);
  return (data || []).map(parsePostgresRow);
}

export async function getApplicabilityForEvidence(evidenceItemId) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('pcs_applicability')
    .select('*')
    .eq('evidence_item_id', evidenceItemId);
  if (error) throw new Error(`Applicability read failed: ${error.message}`);
  return (data || []).map(parsePostgresRow);
}

export async function getApplicabilityById(id) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('pcs_applicability')
    .select('*')
    .eq('notion_page_id', id)
    .maybeSingle();
  if (error) throw new Error(`Applicability read failed: ${error.message}`);
  return data ? parsePostgresRow(data) : null;
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
}
