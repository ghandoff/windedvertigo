/**
 * Run queries â CRUD and visibility-aware listing.
 *
 * Visibility model (from DESIGN.md section 10):
 *   - Internal admins: see all runs across all orgs
 *   - Internal org users: see all runs for their org
 *   - External org users: see only their own runs
 *
 * App-created runs use `notion_id = 'app:<uuid>'` to distinguish
 * from Notion-synced runs.
 *
 * MVP 5 â runs and evidence.
 */

import { sql } from "@/lib/db";

/* Re-export shared enums so existing imports keep working */
export { RUN_TYPES, TRACE_EVIDENCE_OPTIONS, CONTEXT_TAGS as RUN_CONTEXT_TAGS } from "@/lib/constants/enums";

/* ------------------------------------------------------------------ */
/*  types                                                              */
/* ------------------------------------------------------------------ */

export interface RunRow {
  id: string;
  title: string;
  playdate_title: string | null;
  playdate_slug: string | null;
  run_type: string | null;
  run_date: string | null;
  context_tags: string[];
  trace_evidence: string[];
  what_changed: string | null;
  next_iteration: string | null;
  materials: { id: string; title: string }[];
  created_by: string | null;
  org_id: string | null;
  created_at: string | null;
}

export interface CreateRunInput {
  title: string;
  playdateId: string | null;
  runType: string;
  runDate: string;
  contextTags: string[];
  traceEvidence: string[];
  whatChanged: string | null;
  nextIteration: string | null;
  materialIds: string[];
  /** Flag this run as a "find again" moment — playbook badge tier */
  isFindAgain?: boolean;
}

/* ------------------------------------------------------------------ */
/*  visibility-aware listing                                           */
/* ------------------------------------------------------------------ */

/**
 * List runs based on the caller's visibility.
 *
 * - Admin: all runs, ordered by date DESC
 * - Org member (internal): all runs for their org
 * - Org member (external): only runs they created
 * - No org: only runs they created
 */
export async function getRunsForUser(
  session: {
    userId: string;
    orgId: string | null;
    isAdmin: boolean;
  },
  limit = 50,
  offset = 0,
): Promise<RunRow[]> {
  let query: string;
  let params: any[];

  if (session.isAdmin) {
    // Admins see all runs
    query = `
      SELECT r.id, r.title, r.run_type, r.run_date,
             r.context_tags, r.trace_evidence,
             r.what_changed, r.next_iteration,
             r.created_by, r.org_id,
             r.synced_at AS created_at,
             p.title AS playdate_title,
             p.slug AS playdate_slug
      FROM runs_cache r
      LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
      ORDER BY r.run_date DESC NULLS LAST, r.title ASC
      LIMIT $1 OFFSET $2
    `;
    params = [limit, offset];
  } else if (session.orgId) {
    // Org members see all runs for their org
    query = `
      SELECT r.id, r.title, r.run_type, r.run_date,
             r.context_tags, r.trace_evidence,
             r.what_changed, r.next_iteration,
             r.created_by, r.org_id,
             r.synced_at AS created_at,
             p.title AS playdate_title,
             p.slug AS playdate_slug
      FROM runs_cache r
      LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
      WHERE r.org_id = $1
         OR r.created_by = $2
      ORDER BY r.run_date DESC NULLS LAST, r.title ASC
      LIMIT $3 OFFSET $4
    `;
    params = [session.orgId, session.userId, limit, offset];
  } else {
    // No org: only own runs
    query = `
      SELECT r.id, r.title, r.run_type, r.run_date,
             r.context_tags, r.trace_evidence,
             r.what_changed, r.next_iteration,
             r.created_by, r.org_id,
             r.synced_at AS created_at,
             p.title AS playdate_title,
             p.slug AS playdate_slug
      FROM runs_cache r
      LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
      WHERE r.created_by = $1
      ORDER BY r.run_date DESC NULLS LAST, r.title ASC
      LIMIT $2 OFFSET $3
    `;
    params = [session.userId, limit, offset];
  }

  const result = await sql.query(query, params);
  return result.rows;
}

/**
 * Get a single run by ID with visibility check.
 * Returns null if the user doesn't have access.
 */
export async function getRunById(
  runId: string,
  session: { userId: string; orgId: string | null; isAdmin: boolean },
): Promise<RunRow | null> {
  const result = await sql.query(
    `SELECT r.id, r.title, r.run_type, r.run_date,
            r.context_tags, r.trace_evidence,
            r.what_changed, r.next_iteration,
            r.created_by, r.org_id,
            r.synced_at AS created_at,
            p.title AS playdate_title,
            p.slug AS playdate_slug
     FROM runs_cache r
     LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
     WHERE r.id = $1
     LIMIT 1`,
    [runId],
  );

  const run = result.rows[0] ?? null;
  if (!run) return null;

  // Visibility check
  if (session.isAdmin) return run;
  if (run.created_by === session.userId) return run;
  if (session.orgId && run.org_id === session.orgId) return run;

  return null; // no access
}

/**
 * Get materials linked to a run.
 */
export async function getRunMaterials(
  runId: string,
): Promise<{ id: string; title: string }[]> {
  const result = await sql.query(
    `SELECT m.id, m.title
     FROM materials_cache m
     JOIN run_materials rm ON rm.material_id = m.id
     WHERE rm.run_id = $1
     ORDER BY m.title ASC`,
    [runId],
  );
  return result.rows;
}

/**
 * Batch-fetch materials for a list of run IDs in a single query.
 * Returns a map of runId → material array.
 *
 * Audit fix #9: replaces the N+1 pattern (one getRunMaterials call per
 * run) with a single query using ANY($1::uuid[]).
 */
export async function batchGetRunMaterials(
  runIds: string[],
): Promise<Map<string, { id: string; title: string }[]>> {
  const map = new Map<string, { id: string; title: string }[]>();
  if (runIds.length === 0) return map;

  const result = await sql.query(
    `SELECT rm.run_id, m.id, m.title
     FROM run_materials rm
     JOIN materials_cache m ON m.id = rm.material_id
     WHERE rm.run_id = ANY($1::uuid[])
     ORDER BY m.title ASC`,
    [runIds],
  );

  for (const row of result.rows) {
    const list = map.get(row.run_id) ?? [];
    list.push({ id: row.id, title: row.title });
    map.set(row.run_id, list);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/*  create / update                                                    */
/* ------------------------------------------------------------------ */

/**
 * Create a new app-originated run.
 * Returns the created run ID.
 */
export async function createRun(
  input: CreateRunInput,
  session: { userId: string; orgId: string | null },
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
  session: { userId: string },
): Promise<boolean> {
  // Check ownership â only creator can edit
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

/* ------------------------------------------------------------------ */
/*  export — all visible runs without pagination (session 12)          */
/* ------------------------------------------------------------------ */

/**
 * Fetch all visible runs for export (CSV / PDF). Same visibility model
 * as getRunsForUser() but without pagination, and with materials
 * included inline as a comma-separated string for CSV friendliness.
 *
 * Reflective fields (what_changed, next_iteration) are only included
 * when the caller is internal (admin or @windedvertigo.com) or is the
 * run's creator — same rule as the API sanitisation logic.
 */
// Audit-2 M2: accept optional limit to cap export size and prevent OOM on Vercel
export async function getRunsForExport(
  session: {
    userId: string;
    orgId: string | null;
    isAdmin: boolean;
    isInternal: boolean;
  },
  limit: number = 500,
): Promise<
  (RunRow & { materials_list: string })[]
> {
  let query: string;
  let params: any[];

  if (session.isAdmin) {
    query = `
      SELECT r.id, r.title, r.run_type, r.run_date,
             r.context_tags, r.trace_evidence,
             r.what_changed, r.next_iteration,
             r.created_by, r.org_id,
             r.synced_at AS created_at,
             p.title AS playdate_title,
             p.slug AS playdate_slug,
             COALESCE(
               (SELECT string_agg(m.title, ', ' ORDER BY m.title)
                FROM run_materials rm
                JOIN materials_cache m ON m.id = rm.material_id
                WHERE rm.run_id = r.id),
               ''
             ) AS materials_list
      FROM runs_cache r
      LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
      ORDER BY r.run_date DESC NULLS LAST, r.title ASC
      LIMIT $1
    `;
    params = [limit];
  } else if (session.orgId) {
    query = `
      SELECT r.id, r.title, r.run_type, r.run_date,
             r.context_tags, r.trace_evidence,
             r.what_changed, r.next_iteration,
             r.created_by, r.org_id,
             r.synced_at AS created_at,
             p.title AS playdate_title,
             p.slug AS playdate_slug,
             COALESCE(
               (SELECT string_agg(m.title, ', ' ORDER BY m.title)
                FROM run_materials rm
                JOIN materials_cache m ON m.id = rm.material_id
                WHERE rm.run_id = r.id),
               ''
             ) AS materials_list
      FROM runs_cache r
      LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
      WHERE r.org_id = $1
         OR r.created_by = $2
      ORDER BY r.run_date DESC NULLS LAST, r.title ASC
      LIMIT $3
    `;
    params = [session.orgId, session.userId, limit];
  } else {
    query = `
      SELECT r.id, r.title, r.run_type, r.run_date,
             r.context_tags, r.trace_evidence,
             r.what_changed, r.next_iteration,
             r.created_by, r.org_id,
             r.synced_at AS created_at,
             p.title AS playdate_title,
             p.slug AS playdate_slug,
             COALESCE(
               (SELECT string_agg(m.title, ', ' ORDER BY m.title)
                FROM run_materials rm
                JOIN materials_cache m ON m.id = rm.material_id
                WHERE rm.run_id = r.id),
               ''
             ) AS materials_list
      FROM runs_cache r
      LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
      WHERE r.created_by = $1
      ORDER BY r.run_date DESC NULLS LAST, r.title ASC
      LIMIT $2
    `;
    params = [session.userId, limit];
  }

  const result = await sql.query(query, params);

  // sanitise reflective fields for non-internal users viewing other people's runs
  return result.rows.map((run: any) => {
    if (session.isInternal || run.created_by === session.userId) {
      return run;
    }
    return {
      ...run,
      what_changed: null,
      next_iteration: null,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  picker data                                                        */
/* ------------------------------------------------------------------ */

/**
 * Get all ready playdates for the "link to playdate" picker.
 * Returns just id, title, slug for the dropdown.
 */
export async function getReadyPlaydatesForPicker(): Promise<
  { id: string; title: string; slug: string }[]
> {
  const result = await sql.query(
    `SELECT id, title, slug
     FROM playdates_cache
     WHERE status = 'ready'
       AND release_channel IN ('sampler', 'pack-only')
     ORDER BY title ASC`,
  );
  return result.rows;
}
