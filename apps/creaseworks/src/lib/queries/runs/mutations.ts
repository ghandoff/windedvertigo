/**
 * Mutation queries for runs (create, update).
 *
 * App-created runs use `notion_id = 'app:<uuid>'` to distinguish
 * from Notion-synced runs.
 */

import { sql } from "@/lib/db";
import { CreateRunInput, SessionMinimal } from "./types";

interface SessionWithOrg extends SessionMinimal {
  orgId: string | null;
}

/**
 * Create a new app-originated run.
 * Returns the created run ID.
 */
export async function createRun(
  input: CreateRunInput,
  session: SessionWithOrg,
): Promise<string> {
  // Resolve playdate's notion_id from the playdate cache ID
  let playdateNotionId: string | null = null;
  if (input.playdateId) {
    const playdateResult = await sql.query(
      `SELECT notion_id FROM playdates_cache WHERE id = $1 LIMIT 1`,
      [input.playdateId],
    );
    playdateNotionId = playdateResult.rows[0]?.notion_id ?? null;
  }

  // Generate a unique notion_id for the app-created run
  const appNotionId = `app:${crypto.randomUUID()}`;

  const result = await sql.query(
    `INSERT INTO runs_cache
       (notion_id, title, playdate_notion_id, run_type, run_date,
        context_tags, trace_evidence, what_changed, next_iteration,
        created_by, org_id, source, is_find_again)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'app', $12)
     RETURNING id`,
    [
      appNotionId,
      input.title,
      playdateNotionId,
      input.runType,
      input.runDate,
      JSON.stringify(input.contextTags),
      JSON.stringify(input.traceEvidence),
      input.whatChanged || null,
      input.nextIteration || null,
      session.userId,
      session.orgId,
      input.isFindAgain ?? false,
    ],
  );

  const runId = result.rows[0].id;

  // Link materials
  if (input.materialIds.length > 0) {
    const placeholders = input.materialIds
      .map((_, i) => `($1, $${i + 2})`)
      .join(", ");
    await sql.query(
      `INSERT INTO run_materials (run_id, material_id)
       VALUES ${placeholders}
       ON CONFLICT DO NOTHING`,
      [runId, ...input.materialIds],
    );
  }

  return runId;
}

/**
 * Update an existing run. Only the creator can update.
 * Returns true if updated, false if not found or not authorised.
 */
export async function updateRun(
  runId: string,
  input: Partial<CreateRunInput>,
  session: SessionMinimal,
): Promise<boolean> {
  // Check ownership — only creator can edit
  const check = await sql.query(
    `SELECT created_by FROM runs_cache WHERE id = $1 LIMIT 1`,
    [runId],
  );
  if (!check.rows[0] || check.rows[0].created_by !== session.userId) {
    return false;
  }

  // Build SET clause dynamically
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (input.title !== undefined) {
    sets.push(`title = $${idx++}`);
    params.push(input.title);
  }
  if (input.runType !== undefined) {
    sets.push(`run_type = $${idx++}`);
    params.push(input.runType);
  }
  if (input.runDate !== undefined) {
    sets.push(`run_date = $${idx++}`);
    params.push(input.runDate);
  }
  if (input.contextTags !== undefined) {
    sets.push(`context_tags = $${idx++}`);
    params.push(JSON.stringify(input.contextTags));
  }
  if (input.traceEvidence !== undefined) {
    sets.push(`trace_evidence = $${idx++}`);
    params.push(JSON.stringify(input.traceEvidence));
  }
  if (input.whatChanged !== undefined) {
    sets.push(`what_changed = $${idx++}`);
    params.push(input.whatChanged || null);
  }
  if (input.nextIteration !== undefined) {
    sets.push(`next_iteration = $${idx++}`);
    params.push(input.nextIteration || null);
  }

  if (input.isFindAgain !== undefined) {
    sets.push(`is_find_again = $${idx++}`);
    params.push(input.isFindAgain);
  }

  if (input.playdateId !== undefined) {
    let playdateNotionId: string | null = null;
    if (input.playdateId) {
      const playdateResult = await sql.query(
        `SELECT notion_id FROM playdates_cache WHERE id = $1 LIMIT 1`,
        [input.playdateId],
      );
      playdateNotionId = playdateResult.rows[0]?.notion_id ?? null;
    }
    sets.push(`playdate_notion_id = $${idx++}`);
    params.push(playdateNotionId);
  }

  if (sets.length > 0) {
    params.push(runId);
    await sql.query(
      `UPDATE runs_cache SET ${sets.join(", ")} WHERE id = $${idx}`,
      params,
    );
  }

  // Update materials if provided
  if (input.materialIds !== undefined) {
    await sql.query(`DELETE FROM run_materials WHERE run_id = $1`, [runId]);
    if (input.materialIds.length > 0) {
      const placeholders = input.materialIds
        .map((_, i) => `($1, $${i + 2})`)
        .join(", ");
      await sql.query(
        `INSERT INTO run_materials (run_id, material_id)
         VALUES ${placeholders}
         ON CONFLICT DO NOTHING`,
        [runId, ...input.materialIds],
      );
    }
  }

  return true;
}
