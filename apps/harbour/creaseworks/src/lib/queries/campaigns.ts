/**
 * Campaign metadata queries.
 *
 * Campaigns are promotional groupings of playdates — scavenger hunts,
 * partner activations, themed drops.  Playdate association is via
 * `campaign_tags TEXT[]` on `playdates_cache`; this table stores the
 * display metadata so we don't hardcode it in components.
 */

import { sql } from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  types                                                              */
/* ------------------------------------------------------------------ */

export interface Campaign {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  /** number of ready playdates tagged with this campaign */
  playdate_count?: number;
}

/* ------------------------------------------------------------------ */
/*  reads                                                              */
/* ------------------------------------------------------------------ */

/** Get all campaigns (admin view — includes inactive). */
export async function getAllCampaigns(): Promise<Campaign[]> {
  const result = await sql.query(
    `SELECT c.*,
       (SELECT COUNT(*)::int FROM playdates_cache p
        WHERE c.slug = ANY(p.campaign_tags) AND p.status = 'ready'
       ) AS playdate_count
     FROM campaigns c
     ORDER BY c.created_at DESC`,
  );
  return result.rows as Campaign[];
}

/** Get a single campaign by slug (public — active only). */
export async function getCampaignBySlug(slug: string): Promise<Campaign | null> {
  const result = await sql.query(
    `SELECT c.*,
       (SELECT COUNT(*)::int FROM playdates_cache p
        WHERE c.slug = ANY(p.campaign_tags) AND p.status = 'ready'
       ) AS playdate_count
     FROM campaigns c
     WHERE c.slug = $1
     LIMIT 1`,
    [slug],
  );
  return (result.rows[0] as Campaign) ?? null;
}

/* ------------------------------------------------------------------ */
/*  writes (admin)                                                     */
/* ------------------------------------------------------------------ */

/** Create a new campaign. */
export async function createCampaign(
  slug: string,
  title: string,
  description: string | null,
): Promise<Campaign> {
  const result = await sql.query(
    `INSERT INTO campaigns (slug, title, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [slug, title, description],
  );
  return result.rows[0] as Campaign;
}

/** Update an existing campaign. */
export async function updateCampaign(
  id: string,
  fields: { title?: string; description?: string | null; active?: boolean },
): Promise<Campaign | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (fields.title !== undefined) {
    sets.push(`title = $${idx++}`);
    vals.push(fields.title);
  }
  if (fields.description !== undefined) {
    sets.push(`description = $${idx++}`);
    vals.push(fields.description);
  }
  if (fields.active !== undefined) {
    sets.push(`active = $${idx++}`);
    vals.push(fields.active);
  }

  if (sets.length === 0) return null;

  sets.push(`updated_at = NOW()`);
  vals.push(id);

  const result = await sql.query(
    `UPDATE campaigns SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals,
  );
  return (result.rows[0] as Campaign) ?? null;
}

/** Delete a campaign (hard delete). */
export async function deleteCampaign(id: string): Promise<boolean> {
  const result = await sql.query(
    `DELETE FROM campaigns WHERE id = $1`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}
