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

import { notion } from './notion.js';
import {
  getPcsSupabase,
  mirrorToPostgres,
  writePostgresFirst,
  shouldUseStrongConsistency,
} from './supabase-pcs.js';
import {
  shouldReadFromSqrPostgres,
  shouldWriteToSqrPostgresFirst,
  shouldUseSqrStrongConsistency,
  SQR_DB,
} from './sqr-config.js';

// Notion returns `pdf` as a file property, Postgres column is `pdf_url`.
// Mirrors EVIDENCE_PG_COLUMN_MAP in pcs-evidence.js.
const INTAKES_PG_COLUMN_MAP = { pdf: 'pdf_url' };

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers (not exported)
// ─────────────────────────────────────────────────────────────────────────────

function extractTitle(prop) {
  return prop?.title?.[0]?.plain_text || '';
}

function extractRichText(prop) {
  return (prop?.rich_text || []).map(t => t.plain_text).join('');
}

function extractFileUrl(prop) {
  const file = prop?.files?.[0];
  if (!file) return null;
  return file.external?.url || file.file?.url || null;
}

function parseIntakePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    citation: extractTitle(p['Citation']),
    doi: p['DOI']?.url || '',
    year: p['Year']?.number || null,
    journal: extractRichText(p['Journal']),
    purposeOfResearch: extractRichText(p['Purpose of Research']),
    studyDesign: extractRichText(p['Study Design']),
    fundingSources: extractRichText(p['Funding Source(s)']),
    inclusionCriteria: extractRichText(p['Inclusion Criteria']),
    exclusionCriteria: extractRichText(p['Exclusion Criteria']),
    recruitment: extractRichText(p['Recruitment']),
    blinding: p['Blinding']?.select?.name || '',
    initialN: p['Initial N']?.number || null,
    ages: extractRichText(p['Ages (group means)']),
    femaleParticipants: p['Female Participants']?.number || null,
    maleParticipants: p['Male Participants']?.number || null,
    finalN: p['Final N']?.number || null,
    aPrioriPower: p['A Priori Power Estimation']?.select?.name || '',
    locationCountry: extractRichText(p['Location of Study (Country)']),
    locationCity: extractRichText(p['Location of Study (City)']),
    timingOfMeasures: extractRichText(p['Timing of Measures']),
    independentVariables: extractRichText(p['Independent Variables']),
    dependentVariables: extractRichText(p['Dependent Variables']),
    controlVariables: extractRichText(p['Control Variables']),
    keyResults: extractRichText(p['Key Results']),
    otherResults: extractRichText(p['Other Results']),
    statisticalMethods: extractRichText(p['Statistical Methods']),
    missingDataHandling: extractRichText(p['Missing Data Handling']),
    authorsConclusion: extractRichText(p['Authors\' Conclusion']),
    strengths: extractRichText(p['Strengths']),
    limitations: extractRichText(p['Limitations']),
    potentialBiases: extractRichText(p['Potential Biases']),
    submittedByAlias: extractRichText(p['Submitted by Alias']),
    pdf: extractFileUrl(p['PDF']),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

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
  if (shouldReadFromSqrPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('intakes')
        .select('*')
        .order('year', { ascending: false });
      if (!error && data) return data.map(parsePostgresIntakeRow);
    } catch (err) {
      console.warn('[sqr-intakes] Postgres read failed, falling back to Notion:', err.message);
    }
  }
  let allResults = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: SQR_DB.intakes,
      sorts: [{ property: 'Year', direction: 'descending' }],
      start_cursor: cursor,
    });
    allResults = allResults.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return allResults.map(parseIntakePage);
}

export async function getStudyById(pageId) {
  if (shouldReadFromSqrPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb.from('intakes').select('*').eq('notion_page_id', pageId).maybeSingle();
      if (!error && data) return parsePostgresIntakeRow(data);
    } catch (err) {
      console.warn('[sqr-intakes] Postgres read failed, falling back to Notion:', err.message);
    }
  }
  const page = await notion.pages.retrieve({ page_id: pageId });
  return parseIntakePage(page);
}

export async function createStudy(data) {
  const properties = {
    'Citation': { title: [{ text: { content: data.citation } }] },
    'DOI': { url: data.doi || null },
    'Year': { number: data.year ? Number(data.year) : null },
    'Journal': { rich_text: [{ text: { content: data.journal || '' } }] },
    'Purpose of Research': { rich_text: [{ text: { content: data.purposeOfResearch || '' } }] },
    'Study Design': { rich_text: [{ text: { content: data.studyDesign || '' } }] },
    'Funding Source(s)': { rich_text: [{ text: { content: data.fundingSources || '' } }] },
    'Inclusion Criteria': { rich_text: [{ text: { content: data.inclusionCriteria || '' } }] },
    'Exclusion Criteria': { rich_text: [{ text: { content: data.exclusionCriteria || '' } }] },
    'Recruitment': { rich_text: [{ text: { content: data.recruitment || '' } }] },
    'Initial N': { number: data.initialN ? Number(data.initialN) : null },
    'Ages (group means)': { rich_text: [{ text: { content: data.ages || '' } }] },
    'Female Participants': { number: data.femaleParticipants ? Number(data.femaleParticipants) : null },
    'Male Participants': { number: data.maleParticipants ? Number(data.maleParticipants) : null },
    'Final N': { number: data.finalN ? Number(data.finalN) : null },
    'Location of Study (Country)': { rich_text: [{ text: { content: data.locationCountry || '' } }] },
    'Location of Study (City)': { rich_text: [{ text: { content: data.locationCity || '' } }] },
    'Timing of Measures': { rich_text: [{ text: { content: data.timingOfMeasures || '' } }] },
    'Independent Variables': { rich_text: [{ text: { content: data.independentVariables || '' } }] },
    'Dependent Variables': { rich_text: [{ text: { content: data.dependentVariables || '' } }] },
    'Control Variables': { rich_text: [{ text: { content: data.controlVariables || '' } }] },
    'Key Results': { rich_text: [{ text: { content: data.keyResults || '' } }] },
    'Other Results': { rich_text: [{ text: { content: data.otherResults || '' } }] },
    'Statistical Methods': { rich_text: [{ text: { content: data.statisticalMethods || '' } }] },
    'Missing Data Handling': { rich_text: [{ text: { content: data.missingDataHandling || '' } }] },
    'Authors\' Conclusion': { rich_text: [{ text: { content: data.authorsConclusion || '' } }] },
    'Strengths': { rich_text: [{ text: { content: data.strengths || '' } }] },
    'Limitations': { rich_text: [{ text: { content: data.limitations || '' } }] },
    'Potential Biases': { rich_text: [{ text: { content: data.potentialBiases || '' } }] },
    'Submitted by Alias': { rich_text: [{ text: { content: data.submittedByAlias || '' } }] },
  };
  if (data.blinding) {
    properties['Blinding'] = { select: { name: data.blinding } };
  }
  if (data.aPrioriPower) {
    properties['A Priori Power Estimation'] = { select: { name: data.aPrioriPower } };
  }
  return notion.pages.create({ parent: { database_id: SQR_DB.intakes }, properties });
}

export async function getStudyByDoi(doi) {
  if (!doi) return null;
  if (shouldReadFromSqrPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb.from('intakes').select('*').eq('doi', doi).maybeSingle();
      if (!error && data) return parsePostgresIntakeRow(data);
    } catch (err) {
      console.warn('[sqr-intakes] Postgres read failed, falling back to Notion:', err.message);
    }
  }
  const res = await notion.databases.query({
    database_id: SQR_DB.intakes,
    filter: { property: 'DOI', url: { equals: doi } },
    page_size: 1,
  });
  return res.results[0] ? parseIntakePage(res.results[0]) : null;
}

export async function getIntakesByReviewerAlias(alias) {
  if (shouldReadFromSqrPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('intakes')
        .select('*')
        .eq('submitted_by_alias', alias)
        .order('year', { ascending: false });
      if (!error && data) return data.map(parsePostgresIntakeRow);
    } catch (err) {
      console.warn('[sqr-intakes] Postgres read failed, falling back to Notion:', err.message);
    }
  }
  const res = await notion.databases.query({
    database_id: SQR_DB.intakes,
    filter: { property: 'Submitted by Alias', rich_text: { equals: alias } },
    sorts: [{ property: 'Year', direction: 'descending' }],
  });
  return res.results.map(parseIntakePage);
}

export async function getIntakeByReviewerAndDoi(alias, doi) {
  if (shouldReadFromSqrPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('intakes')
        .select('*')
        .eq('submitted_by_alias', alias)
        .eq('doi', doi)
        .maybeSingle();
      if (!error && data) return parsePostgresIntakeRow(data);
    } catch (err) {
      console.warn('[sqr-intakes] Postgres read failed, falling back to Notion:', err.message);
    }
  }
  const res = await notion.databases.query({
    database_id: SQR_DB.intakes,
    filter: {
      and: [
        { property: 'Submitted by Alias', rich_text: { equals: alias } },
        { property: 'DOI', url: { equals: doi } },
      ],
    },
  });
  return res.results[0] ? parseIntakePage(res.results[0]) : null;
}

export async function updateStudyPdf(studyId, pdfUrl) {
  return notion.pages.update({
    page_id: studyId,
    properties: {
      'PDF': pdfUrl
        ? { files: [{ name: 'PDF', type: 'external', external: { url: pdfUrl } }] }
        : { files: [] },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Postgres sync helpers (Phase 1 — additive, not called by Notion CRUD yet)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drift-sync: pull any Notion edits since `sinceIso` into Postgres.
 * Paginate Notion with a last_edited_time filter, parse each page,
 * mirror to the `intakes` table. Idempotent.
 *
 * Guards on SQR_DB.intakes — if the env var is unset, returns immediately.
 *
 * @param {string} sinceIso — ISO 8601 timestamp (e.g. '2026-05-14T00:00:00Z')
 * @returns {{ count: number, fetched: number, maxSeen: string }}
 */
export async function syncRecentIntakesToPostgres(sinceIso) {
  if (!SQR_DB.intakes) {
    console.warn('[sqr-intakes] syncRecentIntakesToPostgres: NOTION_INTAKE_DB not configured');
    return { count: 0, fetched: 0, maxSeen: sinceIso };
  }
  const filter = {
    timestamp: 'last_edited_time',
    last_edited_time: { on_or_after: sinceIso },
  };
  const res = await notion.databases.query({
    database_id: SQR_DB.intakes,
    filter,
    page_size: 100,
  });
  let maxSeen = sinceIso;
  let mirrored = 0;
  for (const page of res.results) {
    const parsed = parseIntakePage(page);
    const result = await mirrorToPostgres('intakes', parsed, INTAKES_PG_COLUMN_MAP, {
      enqueueOnFailure: shouldUseSqrStrongConsistency(),
    });
    if (result.mirrored) mirrored++;
    if (parsed.lastEditedTime > maxSeen) maxSeen = parsed.lastEditedTime;
  }
  return { count: mirrored, fetched: res.results.length, maxSeen };
}

/**
 * Sync a single Notion intake page into Postgres by page ID.
 * Used by the page-updated webhook to mirror a specific edited row
 * immediately rather than waiting for the drift-sync cron.
 *
 * @param {string} pageId — Notion page ID
 */
export async function syncSingleIntakePageToPostgres(pageId) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const parsed = parseIntakePage(page);
  return mirrorToPostgres('intakes', parsed, INTAKES_PG_COLUMN_MAP, {
    enqueueOnFailure: shouldUseSqrStrongConsistency(),
  });
}
