/**
 * Co-play mode queries for shared session reflections.
 *
 * Allows two parents/caregivers to participate in the same playdate session,
 * generating a shareable invite code and storing the co-play partner's reflections.
 */

import { sql } from "@/lib/db";

/**
 * Reflections submitted by the co-play partner.
 */
export interface CoPlayReflections {
  notes: string;
  rating: number; // 1-5
  highlights: string[];
}

/**
 * Co-play details for a run.
 */
export interface CoPlayDetails {
  inviteCode: string | null;
  coPlayParentId: string | null;
  coPlayParentName: string | null;
  coPlayReflections: CoPlayReflections | null;
}

/**
 * Generate a random 6-character alphanumeric invite code.
 */
export function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Enable co-play mode for a run by generating an invite code.
 * Only the run owner can enable co-play.
 *
 * Returns the invite code, or null if not authorized.
 */
export async function enableCoPlay(
  runId: string,
  userId: string,
): Promise<string | null> {
  // Check ownership
  const check = await sql.query(
    `SELECT created_by FROM runs_cache WHERE id = $1 LIMIT 1`,
    [runId],
  );
  if (!check.rows[0] || check.rows[0].created_by !== userId) {
    return null;
  }

  // Generate invite code
  const inviteCode = generateInviteCode();

  // Store it on the run
  await sql.query(
    `UPDATE runs_cache SET co_play_invite_code = $1 WHERE id = $2`,
    [inviteCode, runId],
  );

  return inviteCode;
}

/**
 * Join a co-play session using an invite code.
 * Sets the co-play partner on the run.
 *
 * Returns true if successful, false if code not found or user is already the owner.
 */
export async function joinCoPlay(
  inviteCode: string,
  userId: string,
): Promise<boolean> {
  // Look up the run by invite code
  const lookup = await sql.query(
    `SELECT id, created_by FROM runs_cache WHERE co_play_invite_code = $1 LIMIT 1`,
    [inviteCode],
  );

  if (!lookup.rows[0]) {
    return false; // code not found
  }

  const run = lookup.rows[0];

  // User cannot be the run owner
  if (run.created_by === userId) {
    return false;
  }

  // Set the co-play parent
  await sql.query(
    `UPDATE runs_cache SET co_play_parent_id = $1 WHERE id = $2`,
    [userId, run.id],
  );

  return true;
}

/**
 * Add reflections from the co-play partner.
 * Only the co-play parent can submit their reflections.
 *
 * Returns true if successful, false if not authorized.
 */
export async function addCoPlayReflections(
  runId: string,
  userId: string,
  reflections: CoPlayReflections,
): Promise<boolean> {
  // Check that the user is the co-play parent on this run
  const check = await sql.query(
    `SELECT co_play_parent_id FROM runs_cache WHERE id = $1 LIMIT 1`,
    [runId],
  );

  if (!check.rows[0] || check.rows[0].co_play_parent_id !== userId) {
    return false;
  }

  // Validate reflections object
  if (!reflections || typeof reflections !== "object") {
    return false;
  }

  // Store reflections
  await sql.query(
    `UPDATE runs_cache SET co_play_reflections = $1 WHERE id = $2`,
    [JSON.stringify(reflections), runId],
  );

  return true;
}

/**
 * Get co-play details for a run.
 * Can be called by the run owner or the co-play partner.
 *
 * Returns null if not authorized.
 */
export async function getCoPlayDetails(
  runId: string,
  userId: string,
): Promise<CoPlayDetails | null> {
  // Get run details
  const run = await sql.query(
    `SELECT created_by, co_play_invite_code, co_play_parent_id, co_play_reflections
     FROM runs_cache
     WHERE id = $1
     LIMIT 1`,
    [runId],
  );

  if (!run.rows[0]) {
    return null;
  }

  const runData = run.rows[0];

  // Check authorization: user must be owner or co-play partner
  if (
    runData.created_by !== userId &&
    runData.co_play_parent_id !== userId
  ) {
    return null;
  }

  // Get co-play parent's name if they exist
  let coPlayParentName: string | null = null;
  if (runData.co_play_parent_id) {
    const userQuery = await sql.query(
      `SELECT name FROM users WHERE id = $1 LIMIT 1`,
      [runData.co_play_parent_id],
    );
    coPlayParentName = userQuery.rows[0]?.name ?? null;
  }

  // Parse reflections JSONB
  const reflections: CoPlayReflections | null = runData.co_play_reflections
    ? JSON.parse(runData.co_play_reflections)
    : null;

  return {
    inviteCode: runData.co_play_invite_code,
    coPlayParentId: runData.co_play_parent_id,
    coPlayParentName,
    coPlayReflections: reflections,
  };
}
