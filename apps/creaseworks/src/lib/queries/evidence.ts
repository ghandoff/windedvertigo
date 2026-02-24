/**
 * Evidence queries — CRUD for run_evidence items.
 *
 * Phase A of evidence capture (practitioner tier).
 *
 * Each evidence item belongs to a run and has a type:
 *   photo       — storage_key + thumbnail_key (R2 object keys)
 *   quote       — quote_text + quote_attribution
 *   observation — body + optional prompt_key
 *   artifact    — body (description of what was made)
 */

import { sql } from "@/lib/db";
import type { CWSession } from "@/lib/auth-helpers";

/* ------------------------------------------------------------------ */
/*  types                                                              */
/* ------------------------------------------------------------------ */

export type EvidenceType = "photo" | "quote" | "observation" | "artifact";

export interface EvidenceRow {
  id: string;
  run_id: string;
  evidence_type: EvidenceType;
  storage_key: string | null;
  thumbnail_key: string | null;
  quote_text: string | null;
  quote_attribution: string | null;
  body: string | null;
  prompt_key: string | null;
  sort_order: number;
  created_at: string;
}

export interface CreateEvidenceInput {
  evidenceType: EvidenceType;
  storageKey?: string | null;
  thumbnailKey?: string | null;
  quoteText?: string | null;
  quoteAttribution?: string | null;
  body?: string | null;
  promptKey?: string | null;
  sortOrder?: number;
}

export interface UpdateEvidenceInput {
  quoteText?: string | null;
  quoteAttribution?: string | null;
  body?: string | null;
  promptKey?: string | null;
  sortOrder?: number;
  storageKey?: string | null;
  thumbnailKey?: string | null;
}

/* ------------------------------------------------------------------ */
/*  ownership check                                                    */
/* ------------------------------------------------------------------ */

/**
 * Verify the caller owns (created) the run that this evidence belongs to.
 * Returns the run_id if authorised, null otherwise.
 * Admins can edit any run's evidence.
 */
async function assertRunOwnership(
  runId: string,
  session: CWSession,
): Promise<boolean> {
  if (session.isAdmin) return true;

  const result = await sql.query(
    `SELECT 1 FROM runs_cache WHERE id = $1 AND created_by = $2 LIMIT 1`,
    [runId, session.userId],
  );
  return result.rows.length > 0;
}

/* ------------------------------------------------------------------ */
/*  list evidence for a run                                            */
/* ------------------------------------------------------------------ */

/**
 * Get all evidence items for a run, ordered by sort_order then created_at.
 * Visibility: anyone who can view the run can view its evidence.
 */
export async function getEvidenceForRun(
  runId: string,
): Promise<EvidenceRow[]> {
  const result = await sql.query(
    `SELECT id, run_id, evidence_type,
            storage_key, thumbnail_key,
            quote_text, quote_attribution,
            body, prompt_key,
            sort_order, created_at
     FROM run_evidence
     WHERE run_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [runId],
  );
  return result.rows as EvidenceRow[];
}

/**
 * Batch-fetch evidence for multiple runs (avoids N+1).
 * Returns a Map of run_id → EvidenceRow[].
 */
export async function batchGetRunEvidence(
  runIds: string[],
): Promise<Map<string, EvidenceRow[]>> {
  if (runIds.length === 0) return new Map();

  const result = await sql.query(
    `SELECT id, run_id, evidence_type,
            storage_key, thumbnail_key,
            quote_text, quote_attribution,
            body, prompt_key,
            sort_order, created_at
     FROM run_evidence
     WHERE run_id = ANY($1::uuid[])
     ORDER BY sort_order ASC, created_at ASC`,
    [runIds],
  );

  const map = new Map<string, EvidenceRow[]>();
  for (const row of result.rows) {
    const list = map.get(row.run_id) ?? [];
    list.push(row as EvidenceRow);
    map.set(row.run_id, list);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/*  create evidence                                                    */
/* ------------------------------------------------------------------ */

/**
 * Create a new evidence item for a run. Caller must own the run.
 * Returns the new evidence ID.
 */
export async function createEvidence(
  runId: string,
  input: CreateEvidenceInput,
  session: CWSession,
): Promise<string | null> {
  const owned = await assertRunOwnership(runId, session);
  if (!owned) return null;

  const result = await sql.query(
    `INSERT INTO run_evidence
       (run_id, evidence_type, storage_key, thumbnail_key,
        quote_text, quote_attribution, body, prompt_key, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      runId,
      input.evidenceType,
      input.storageKey ?? null,
      input.thumbnailKey ?? null,
      input.quoteText ?? null,
      input.quoteAttribution ?? null,
      input.body ?? null,
      input.promptKey ?? null,
      input.sortOrder ?? 0,
    ],
  );

  return result.rows[0]?.id ?? null;
}

/* ------------------------------------------------------------------ */
/*  update evidence                                                    */
/* ------------------------------------------------------------------ */

/**
 * Update a single evidence item. Caller must own the parent run.
 * Returns true if updated, false if not found or not authorised.
 */
export async function updateEvidence(
  evidenceId: string,
  input: UpdateEvidenceInput,
  session: CWSession,
): Promise<boolean> {
  // Look up the evidence item + its run owner in one query
  const lookup = await sql.query(
    `SELECT re.id, r.created_by
     FROM run_evidence re
     JOIN runs_cache r ON r.id = re.run_id
     WHERE re.id = $1`,
    [evidenceId],
  );

  if (lookup.rows.length === 0) return false;
  if (!session.isAdmin && lookup.rows[0].created_by !== session.userId) {
    return false;
  }

  // Build dynamic SET clause
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.quoteText !== undefined) {
    sets.push(`quote_text = $${idx++}`);
    params.push(input.quoteText);
  }
  if (input.quoteAttribution !== undefined) {
    sets.push(`quote_attribution = $${idx++}`);
    params.push(input.quoteAttribution);
  }
  if (input.body !== undefined) {
    sets.push(`body = $${idx++}`);
    params.push(input.body);
  }
  if (input.promptKey !== undefined) {
    sets.push(`prompt_key = $${idx++}`);
    params.push(input.promptKey);
  }
  if (input.sortOrder !== undefined) {
    sets.push(`sort_order = $${idx++}`);
    params.push(input.sortOrder);
  }
  if (input.storageKey !== undefined) {
    sets.push(`storage_key = $${idx++}`);
    params.push(input.storageKey);
  }
  if (input.thumbnailKey !== undefined) {
    sets.push(`thumbnail_key = $${idx++}`);
    params.push(input.thumbnailKey);
  }

  if (sets.length === 0) return true; // nothing to update

  params.push(evidenceId);
  await sql.query(
    `UPDATE run_evidence SET ${sets.join(", ")} WHERE id = $${idx}`,
    params,
  );

  return true;
}

/* ------------------------------------------------------------------ */
/*  delete evidence                                                    */
/* ------------------------------------------------------------------ */

/**
 * Delete a single evidence item. Caller must own the parent run.
 * Returns the deleted row (for cleanup of storage keys) or null.
 */
export async function deleteEvidence(
  evidenceId: string,
  session: CWSession,
): Promise<EvidenceRow | null> {
  // Look up with ownership check
  const lookup = await sql.query(
    `SELECT re.*, r.created_by
     FROM run_evidence re
     JOIN runs_cache r ON r.id = re.run_id
     WHERE re.id = $1`,
    [evidenceId],
  );

  if (lookup.rows.length === 0) return null;
  if (!session.isAdmin && lookup.rows[0].created_by !== session.userId) {
    return null;
  }

  await sql.query(`DELETE FROM run_evidence WHERE id = $1`, [evidenceId]);

  return lookup.rows[0] as EvidenceRow;
}

/* ------------------------------------------------------------------ */
/*  count helpers (for progress tier + analytics)                      */
/* ------------------------------------------------------------------ */

/**
 * Count evidence items for a run. Used by progress tier computation.
 */
export async function countEvidenceForRun(runId: string): Promise<number> {
  const result = await sql.query(
    `SELECT COUNT(*)::int AS count FROM run_evidence WHERE run_id = $1`,
    [runId],
  );
  return result.rows[0]?.count ?? 0;
}

/* ------------------------------------------------------------------ */
/*  portfolio query                                                    */
/* ------------------------------------------------------------------ */

/**
 * Row shape for the portfolio view: evidence enriched with reflection
 * and playdate context.
 */
export interface PortfolioItem {
  id: string;
  evidence_type: EvidenceType;
  storage_key: string | null;
  thumbnail_key: string | null;
  quote_text: string | null;
  quote_attribution: string | null;
  body: string | null;
  prompt_key: string | null;
  created_at: string;
  /* reflection context */
  run_id: string;
  run_title: string;
  run_date: string | null;
  /* playdate context */
  playdate_title: string | null;
  playdate_slug: string | null;
}

/**
 * Fetch all evidence for a user's reflections, newest first.
 * Joins with runs_cache + playdates_cache for display context.
 *
 * Supports optional filters:
 *   - evidenceType: restrict to one type
 *   - playdateSlug: restrict to one playdate
 *   - limit/offset: pagination (default 50)
 */
export async function getPortfolioEvidence(
  userId: string,
  opts: {
    evidenceType?: EvidenceType;
    playdateSlug?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<PortfolioItem[]> {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const conditions = [
    "r.created_by = $1",
  ];
  const params: unknown[] = [userId];
  let idx = 2;

  if (opts.evidenceType) {
    conditions.push(`re.evidence_type = $${idx++}`);
    params.push(opts.evidenceType);
  }
  if (opts.playdateSlug) {
    conditions.push(`p.slug = $${idx++}`);
    params.push(opts.playdateSlug);
  }

  params.push(limit, offset);

  const result = await sql.query(
    `SELECT
       re.id, re.evidence_type,
       re.storage_key, re.thumbnail_key,
       re.quote_text, re.quote_attribution,
       re.body, re.prompt_key,
       re.created_at,
       r.id AS run_id,
       r.title AS run_title,
       r.run_date,
       p.title AS playdate_title,
       p.slug AS playdate_slug
     FROM run_evidence re
     JOIN runs_cache r ON r.id = re.run_id
     LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY re.created_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    params,
  );

  return result.rows as PortfolioItem[];
}

/**
 * Count total evidence items for a user (for pagination).
 */
export async function countPortfolioEvidence(
  userId: string,
  opts: { evidenceType?: EvidenceType; playdateSlug?: string } = {},
): Promise<number> {
  const conditions = ["r.created_by = $1"];
  const params: unknown[] = [userId];
  let idx = 2;

  if (opts.evidenceType) {
    conditions.push(`re.evidence_type = $${idx++}`);
    params.push(opts.evidenceType);
  }
  if (opts.playdateSlug) {
    conditions.push(`p.slug = $${idx++}`);
    params.push(opts.playdateSlug);
  }

  const result = await sql.query(
    `SELECT COUNT(*)::int AS count
     FROM run_evidence re
     JOIN runs_cache r ON r.id = re.run_id
     LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
     WHERE ${conditions.join(" AND ")}`,
    params,
  );

  return result.rows[0]?.count ?? 0;
}

/**
 * Check if ANY run for a given user+playdate has evidence in run_evidence.
 * Used to upgrade the found_something tier.
 */
export async function hasStructuredEvidence(
  userId: string,
  playdateNotionId: string,
): Promise<boolean> {
  const result = await sql.query(
    `SELECT 1
     FROM run_evidence re
     JOIN runs_cache r ON r.id = re.run_id
     WHERE r.created_by = $1
       AND r.playdate_notion_id = $2
     LIMIT 1`,
    [userId, playdateNotionId],
  );
  return result.rows.length > 0;
}
