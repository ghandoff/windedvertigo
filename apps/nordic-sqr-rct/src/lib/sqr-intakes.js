/**
 * SQR-RCT Intake CRUD — Notion-canonical with Postgres mirror scaffolding.
 *
 * Phase 1 of the Postgres migration. All existing functions keep their
 * Notion-only behavior unchanged. The Postgres methods (parsePostgresIntakeRow,
 * syncRecentIntakesToPostgres, syncSingleIntakePageToPostgres) are additive.
 *
 * Phase 3 — read functions are gated behind shouldReadFromSqrPostgres().
 * Write functions (create, update) are NOT gated — Notion-only for now.
 */

import {
  getPcsSupabase,
  writePostgresFirst,
} from './supabase-pcs.js';
import {
  shouldWriteToSqrPostgresFirst,
} from './sqr-config.js';

// Notion returns `pdf` as a file property, Postgres column is `pdf_url`.
// Mirrors EVIDENCE_PG_COLUMN_MAP in pcs-evidence.js.
const INTAKES_PG_COLUMN_MAP = { pdf: 'pdf_url' };

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers (not exported)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Postgres inverse mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a Postgres `intakes` table row back to the parseIntakePage shape.
 * All snake_case → camelCase. `notion_page_id` becomes `id`.
 *
 * `pdf` is stored as `pdf_url` in Postgres (column map override) but exposed
 * as `pdf` here to match the Notion property semantic — mirrors pcs-evidence.js.
 */
export function parsePostgresIntakeRow(row) {
  return {
    id: row.notion_page_id,
    citation: row.citation || '',
    doi: row.doi || '',
    year: row.year ?? null,
    journal: row.journal || '',
    purposeOfResearch: row.purpose_of_research || '',
    studyDesign: row.study_design || '',
    fundingSources: row.funding_sources || '',
    inclusionCriteria: row.inclusion_criteria || '',
    exclusionCriteria: row.exclusion_criteria || '',
    recruitment: row.recruitment || '',
    blinding: row.blinding || '',
    initialN: row.initial_n ?? null,
    ages: row.ages || '',
    femaleParticipants: row.female_participants ?? null,
    maleParticipants: row.male_participants ?? null,
    finalN: row.final_n ?? null,
    aPrioriPower: row.a_priori_power || '',
    locationCountry: row.location_country || '',
    locationCity: row.location_city || '',
    timingOfMeasures: row.timing_of_measures || '',
    independentVariables: row.independent_variables || '',
    dependentVariables: row.dependent_variables || '',
    controlVariables: row.control_variables || '',
    keyResults: row.key_results || '',
    otherResults: row.other_results || '',
    statisticalMethods: row.statistical_methods || '',
    missingDataHandling: row.missing_data_handling || '',
    authorsConclusion: row.authors_conclusion || '',
    strengths: row.strengths || '',
    limitations: row.limitations || '',
    potentialBiases: row.potential_biases || '',
    submittedByAlias: row.submitted_by_alias || '',
    pdf: row.pdf_url || null,
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Notion CRUD (Phase 1 — Notion-only, no read/write gating yet)
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllStudies() {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('intakes')
    .select('*')
    .order('year', { ascending: false });
  if (error) throw error;
  return (data || []).map(parsePostgresIntakeRow);
}

export async function getStudyById(pageId) {
  const sb = getPcsSupabase();
  const { data, error } = await sb.from('intakes').select('*').eq('notion_page_id', pageId).maybeSingle();
  if (error) throw error;
  return data ? parsePostgresIntakeRow(data) : null;
}

export async function createStudy(data) {
  if (shouldWriteToSqrPostgresFirst()) {
    const preId = crypto.randomUUID();
    const stubRow = {
      id: preId,
      citation: data.citation || '',
      doi: data.doi || '',
      year: data.year ? Number(data.year) : null,
      journal: data.journal || '',
      purposeOfResearch: data.purposeOfResearch || '',
      studyDesign: data.studyDesign || '',
      fundingSources: data.fundingSources || '',
      inclusionCriteria: data.inclusionCriteria || '',
      exclusionCriteria: data.exclusionCriteria || '',
      recruitment: data.recruitment || '',
      blinding: data.blinding || '',
      initialN: data.initialN ? Number(data.initialN) : null,
      ages: data.ages || '',
      femaleParticipants: data.femaleParticipants ? Number(data.femaleParticipants) : null,
      maleParticipants: data.maleParticipants ? Number(data.maleParticipants) : null,
      finalN: data.finalN ? Number(data.finalN) : null,
      aPrioriPower: data.aPrioriPower || '',
      locationCountry: data.locationCountry || '',
      locationCity: data.locationCity || '',
      timingOfMeasures: data.timingOfMeasures || '',
      independentVariables: data.independentVariables || '',
      dependentVariables: data.dependentVariables || '',
      controlVariables: data.controlVariables || '',
      keyResults: data.keyResults || '',
      otherResults: data.otherResults || '',
      statisticalMethods: data.statisticalMethods || '',
      missingDataHandling: data.missingDataHandling || '',
      authorsConclusion: data.authorsConclusion || '',
      strengths: data.strengths || '',
      limitations: data.limitations || '',
      potentialBiases: data.potentialBiases || '',
      submittedByAlias: data.submittedByAlias || '',
      pdf: data.pdf || null,
    };
    await writePostgresFirst(
      'intakes',
      stubRow,
      INTAKES_PG_COLUMN_MAP,
    );
    return stubRow;
  }
}

export async function getStudyByDoi(doi) {
  if (!doi) return null;
  const sb = getPcsSupabase();
  const { data, error } = await sb.from('intakes').select('*').eq('doi', doi).maybeSingle();
  if (error) throw error;
  return data ? parsePostgresIntakeRow(data) : null;
}

export async function getIntakesByReviewerAlias(alias) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('intakes')
    .select('*')
    .eq('submitted_by_alias', alias)
    .order('year', { ascending: false });
  if (error) throw error;
  return (data || []).map(parsePostgresIntakeRow);
}

export async function getIntakeByReviewerAndDoi(alias, doi) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('intakes')
    .select('*')
    .eq('submitted_by_alias', alias)
    .eq('doi', doi)
    .maybeSingle();
  if (error) throw error;
  return data ? parsePostgresIntakeRow(data) : null;
}

export async function updateStudyPdf(studyId, pdfUrl) {
  if (shouldWriteToSqrPostgresFirst()) {
    const stubRow = { id: studyId, pdf: pdfUrl || null };
    await writePostgresFirst(
      'intakes',
      stubRow,
      INTAKES_PG_COLUMN_MAP,
    );
    return stubRow;
  }
}
