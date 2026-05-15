/**
 * SQR-RCT Score CRUD — Notion-canonical with Postgres mirror scaffolding.
 *
 * Phase 1 of the Postgres migration. All existing functions keep their
 * Notion-only behavior unchanged. The Postgres methods (parsePostgresScoreRow,
 * syncRecentScoresToPostgres, syncSingleScorePageToPostgres) are additive.
 *
 * Phase 3 — read functions are gated behind shouldReadFromSqrPostgres().
 * Write functions (create) are NOT gated — Notion-only for now.
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

// 'timestamp' is a Postgres reserved word; the column is named `scored_at`.
// This mirrors the pcs-evidence.js convention of { pdf: 'pdf_url' }.
const SCORES_PG_COLUMN_MAP = { timestamp: 'scored_at' };

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers (not exported)
// ─────────────────────────────────────────────────────────────────────────────

function extractTitle(prop) {
  return prop?.title?.[0]?.plain_text || '';
}

function extractRichText(prop) {
  return (prop?.rich_text || []).map(t => t.plain_text).join('');
}

function parseScorePage(page) {
  const p = page.properties;
  const extractScore = (val) => {
    const name = val?.select?.name || '';
    const match = name.match(/^(\d)/);
    return match ? Number(match[1]) : null;
  };
  return {
    id: page.id,
    scoreId: extractTitle(p['Score ID']),
    studyRelation: (p['Study']?.relation || []).map(r => r.id),
    reviewerRelation: (p['Reviewer']?.relation || []).map(r => r.id),
    raterAlias: p['Rater Alias']?.select?.name || '',
    q1: extractScore(p['Q1 Research Question']),
    q2: extractScore(p['Q2 Randomization']),
    q3: extractScore(p['Q3 Blinding']),
    q4: extractScore(p['Q4 Sample Size']),
    q5: extractScore(p['Q5 Baseline Characteristics']),
    q6: extractScore(p['Q6 Participant Flow']),
    q7: extractScore(p['Q7 Intervention Description']),
    q8: extractScore(p['Q8 Outcome Measurement']),
    q9: extractScore(p['Q9 Statistical Analysis']),
    q10: extractScore(p['Q10 Bias Assessment']),
    q11: extractScore(p['Q11 Applicability']),
    q1Raw: p['Q1 Research Question']?.select?.name || '',
    q2Raw: p['Q2 Randomization']?.select?.name || '',
    q3Raw: p['Q3 Blinding']?.select?.name || '',
    q4Raw: p['Q4 Sample Size']?.select?.name || '',
    q5Raw: p['Q5 Baseline Characteristics']?.select?.name || '',
    q6Raw: p['Q6 Participant Flow']?.select?.name || '',
    q7Raw: p['Q7 Intervention Description']?.select?.name || '',
    q8Raw: p['Q8 Outcome Measurement']?.select?.name || '',
    q9Raw: p['Q9 Statistical Analysis']?.select?.name || '',
    q10Raw: p['Q10 Bias Assessment']?.select?.name || '',
    q11Raw: p['Q11 Applicability']?.select?.name || '',
    rubricVersion: p['Rubric version']?.select?.name || '',
    notes: extractRichText(p['Notes']),
    // `timestamp` is the Notion shape key; maps to `scored_at` in Postgres
    // via SCORES_PG_COLUMN_MAP (reserved-word avoidance).
    timestamp: p['Timestamp']?.date?.start || page.created_time,
    timeToComplete: p['Time to Complete (minutes)']?.number || null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Postgres inverse mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a Postgres `scores` table row back to the parseScorePage shape.
 * All snake_case → camelCase. `notion_page_id` becomes `id`.
 *
 * `scored_at` (Postgres column) maps back to `timestamp` (Notion shape key)
 * so downstream callers that read `row.timestamp` keep working.
 */
export function parsePostgresScoreRow(row) {
  return {
    id: row.notion_page_id,
    scoreId: row.score_id || '',
    studyRelation: row.study_relation || [],
    reviewerRelation: row.reviewer_relation || [],
    raterAlias: row.rater_alias || '',
    q1: row.q1 ?? null,
    q2: row.q2 ?? null,
    q3: row.q3 ?? null,
    q4: row.q4 ?? null,
    q5: row.q5 ?? null,
    q6: row.q6 ?? null,
    q7: row.q7 ?? null,
    q8: row.q8 ?? null,
    q9: row.q9 ?? null,
    q10: row.q10 ?? null,
    q11: row.q11 ?? null,
    q1Raw: row.q1_raw || '',
    q2Raw: row.q2_raw || '',
    q3Raw: row.q3_raw || '',
    q4Raw: row.q4_raw || '',
    q5Raw: row.q5_raw || '',
    q6Raw: row.q6_raw || '',
    q7Raw: row.q7_raw || '',
    q8Raw: row.q8_raw || '',
    q9Raw: row.q9_raw || '',
    q10Raw: row.q10_raw || '',
    q11Raw: row.q11_raw || '',
    rubricVersion: row.rubric_version || '',
    notes: row.notes || '',
    // `scored_at` → `timestamp` (reverses the column map)
    timestamp: row.scored_at || null,
    timeToComplete: row.time_to_complete ?? null,
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Notion CRUD (Phase 1 — Notion-only, no read/write gating yet)
// ─────────────────────────────────────────────────────────────────────────────

export async function createScore(data) {
  const properties = {
    'Score ID': { title: [{ text: { content: data.scoreId || `SCR-${Date.now()}` } }] },
    'Q1 Research Question': { select: { name: data.q1 } },
    'Q2 Randomization': { select: { name: data.q2 } },
    'Q3 Blinding': { select: { name: data.q3 } },
    'Q4 Sample Size': { select: { name: data.q4 } },
    'Q5 Baseline Characteristics': { select: { name: data.q5 } },
    'Q6 Participant Flow': { select: { name: data.q6 } },
    'Q7 Intervention Description': { select: { name: data.q7 } },
    'Q8 Outcome Measurement': { select: { name: data.q8 } },
    'Q9 Statistical Analysis': { select: { name: data.q9 } },
    'Q10 Bias Assessment': { select: { name: data.q10 } },
    'Q11 Applicability': { select: { name: data.q11 } },
    'Rater Alias': { select: { name: data.raterAlias } },
    'Notes': { rich_text: [{ text: { content: data.notes || '' } }] },
    'Rubric version': { select: { name: data.rubricVersion || 'V2' } },
    'Timestamp': { date: { start: new Date().toISOString() } },
  };
  if (data.studyId) {
    properties['Study'] = { relation: [{ id: data.studyId }] };
  }
  if (data.reviewerId) {
    properties['Reviewer'] = { relation: [{ id: data.reviewerId }] };
  }
  if (data.timeToComplete) {
    properties['Time to Complete (minutes)'] = { number: Number(data.timeToComplete) };
  }
  return notion.pages.create({ parent: { database_id: SQR_DB.scores }, properties });
}

export async function getScoreById(scoreId) {
  if (shouldReadFromSqrPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb.from('scores').select('*').eq('notion_page_id', scoreId).maybeSingle();
      if (!error && data) return parsePostgresScoreRow(data);
    } catch (err) {
      console.warn('[sqr-scores] Postgres read failed, falling back to Notion:', err.message);
    }
  }
  const page = await notion.pages.retrieve({ page_id: scoreId });
  return parseScorePage(page);
}

export async function getScoresByReviewer(reviewerAlias) {
  if (shouldReadFromSqrPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('scores')
        .select('*')
        .eq('rater_alias', reviewerAlias)
        .order('scored_at', { ascending: false });
      if (!error && data) return data.map(parsePostgresScoreRow);
    } catch (err) {
      console.warn('[sqr-scores] Postgres read failed, falling back to Notion:', err.message);
    }
  }
  let allResults = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: SQR_DB.scores,
      filter: { property: 'Rater Alias', select: { equals: reviewerAlias } },
      sorts: [{ property: 'Timestamp', direction: 'descending' }],
      start_cursor: cursor,
    });
    allResults = allResults.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return allResults.map(parseScorePage);
}

export async function getAllScores() {
  if (shouldReadFromSqrPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('scores')
        .select('*')
        .order('scored_at', { ascending: false });
      if (!error && data) return data.map(parsePostgresScoreRow);
    } catch (err) {
      console.warn('[sqr-scores] Postgres read failed, falling back to Notion:', err.message);
    }
  }
  let allResults = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: SQR_DB.scores,
      start_cursor: cursor,
      sorts: [{ property: 'Timestamp', direction: 'descending' }],
    });
    allResults = allResults.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return allResults.map(parseScorePage);
}

export async function getScoresForStudy(studyPageId) {
  if (shouldReadFromSqrPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('scores')
        .select('*')
        .contains('study_relation', [studyPageId])
        .order('scored_at', { ascending: false });
      if (!error && data) return data.map(parsePostgresScoreRow);
    } catch (err) {
      console.warn('[sqr-scores] Postgres read failed, falling back to Notion:', err.message);
    }
  }
  const res = await notion.databases.query({
    database_id: SQR_DB.scores,
    filter: { property: 'Study', relation: { contains: studyPageId } },
    sorts: [{ property: 'Timestamp', direction: 'descending' }],
  });
  return res.results.map(parseScorePage);
}

// ─────────────────────────────────────────────────────────────────────────────
// Postgres sync helpers (Phase 1 — additive, not called by Notion CRUD yet)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drift-sync: pull any Notion edits since `sinceIso` into Postgres.
 * Paginate Notion with a last_edited_time filter, parse each page,
 * mirror to the `scores` table. Idempotent.
 *
 * Guards on SQR_DB.scores — if the env var is unset, returns immediately.
 *
 * @param {string} sinceIso — ISO 8601 timestamp (e.g. '2026-05-14T00:00:00Z')
 * @returns {{ count: number, fetched: number, maxSeen: string }}
 */
export async function syncRecentScoresToPostgres(sinceIso) {
  if (!SQR_DB.scores) {
    console.warn('[sqr-scores] syncRecentScoresToPostgres: NOTION_SCORES_DB not configured');
    return { count: 0, fetched: 0, maxSeen: sinceIso };
  }
  const filter = {
    timestamp: 'last_edited_time',
    last_edited_time: { on_or_after: sinceIso },
  };
  const res = await notion.databases.query({
    database_id: SQR_DB.scores,
    filter,
    page_size: 100,
  });
  let maxSeen = sinceIso;
  let mirrored = 0;
  for (const page of res.results) {
    const parsed = parseScorePage(page);
    const result = await mirrorToPostgres('scores', parsed, SCORES_PG_COLUMN_MAP, {
      enqueueOnFailure: shouldUseSqrStrongConsistency(),
    });
    if (result.mirrored) mirrored++;
    if (parsed.lastEditedTime > maxSeen) maxSeen = parsed.lastEditedTime;
  }
  return { count: mirrored, fetched: res.results.length, maxSeen };
}

/**
 * Sync a single Notion score page into Postgres by page ID.
 * Used by the page-updated webhook to mirror a specific edited row
 * immediately rather than waiting for the drift-sync cron.
 *
 * @param {string} pageId — Notion page ID
 */
export async function syncSingleScorePageToPostgres(pageId) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const parsed = parseScorePage(page);
  return mirrorToPostgres('scores', parsed, SCORES_PG_COLUMN_MAP, {
    enqueueOnFailure: shouldUseSqrStrongConsistency(),
  });
}
