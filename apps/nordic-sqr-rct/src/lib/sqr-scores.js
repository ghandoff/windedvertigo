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

import {
  getPcsSupabase,
  writePostgresFirst,
} from './supabase-pcs.js';
import {
  shouldWriteToSqrPostgresFirst,
} from './sqr-config.js';

// 'timestamp' is a Postgres reserved word; the column is named `scored_at`.
// This mirrors the pcs-evidence.js convention of { pdf: 'pdf_url' }.
const SCORES_PG_COLUMN_MAP = { timestamp: 'scored_at' };

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers (not exported)
// ─────────────────────────────────────────────────────────────────────────────

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
  const scoreId = data.scoreId || `SCR-${Date.now()}`;
  const timestamp = new Date().toISOString();
  if (shouldWriteToSqrPostgresFirst()) {
    const preId = crypto.randomUUID();
    const stubRow = {
      id: preId,
      scoreId,
      studyRelation: data.studyId ? [data.studyId] : [],
      reviewerRelation: data.reviewerId ? [data.reviewerId] : [],
      raterAlias: data.raterAlias || '',
      q1: data.q1 ?? null,
      q2: data.q2 ?? null,
      q3: data.q3 ?? null,
      q4: data.q4 ?? null,
      q5: data.q5 ?? null,
      q6: data.q6 ?? null,
      q7: data.q7 ?? null,
      q8: data.q8 ?? null,
      q9: data.q9 ?? null,
      q10: data.q10 ?? null,
      q11: data.q11 ?? null,
      q1Raw: data.q1 ?? '',
      q2Raw: data.q2 ?? '',
      q3Raw: data.q3 ?? '',
      q4Raw: data.q4 ?? '',
      q5Raw: data.q5 ?? '',
      q6Raw: data.q6 ?? '',
      q7Raw: data.q7 ?? '',
      q8Raw: data.q8 ?? '',
      q9Raw: data.q9 ?? '',
      q10Raw: data.q10 ?? '',
      q11Raw: data.q11 ?? '',
      rubricVersion: data.rubricVersion || 'V2',
      notes: data.notes || '',
      // `timestamp` maps to `scored_at` via SCORES_PG_COLUMN_MAP
      timestamp,
      timeToComplete: data.timeToComplete ? Number(data.timeToComplete) : null,
    };
    await writePostgresFirst(
      'scores',
      stubRow,
      SCORES_PG_COLUMN_MAP,
    );
    return stubRow;
  }
}

export async function getScoreById(scoreId) {
  const sb = getPcsSupabase();
  const { data, error } = await sb.from('scores').select('*').eq('notion_page_id', scoreId).maybeSingle();
  if (error) throw error;
  return data ? parsePostgresScoreRow(data) : null;
}

export async function getScoresByReviewer(reviewerAlias) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('scores')
    .select('*')
    .eq('rater_alias', reviewerAlias)
    .order('scored_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(parsePostgresScoreRow);
}

export async function getAllScores() {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('scores')
    .select('*')
    .order('scored_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(parsePostgresScoreRow);
}

export async function getScoresForStudy(studyPageId) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('scores')
    .select('*')
    .contains('study_relation', [studyPageId])
    .order('scored_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(parsePostgresScoreRow);
}
