/**
 * Notification / digest query functions.
 *
 * Session 21: weekly email digest system.
 */

import { sql } from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  types                                                              */
/* ------------------------------------------------------------------ */

export interface NotificationPrefs {
  userId: string;
  digestEnabled: boolean;
  digestFrequency: "weekly" | "never";
  lastDigestAt: string | null;
}

export interface DigestUser {
  id: string;
  email: string;
  name: string | null;
  lastDigestAt: string | null;
}

export interface DigestContent {
  newPlaydates: { title: string; slug: string; headline: string | null }[];
  recentReflections: number;
  evidenceCount: number;
  progressChanges: { playdateTitle: string; tier: string }[];
  untried: { title: string; slug: string; collectionTitle: string }[];
  isEmpty: boolean;
}

/* ------------------------------------------------------------------ */
/*  preference helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Return notification prefs for a user, creating a default row
 * (digest_enabled = true, frequency = weekly) if none exists.
 */
export async function getOrCreatePrefs(
  userId: string,
): Promise<NotificationPrefs> {
  const r = await sql.query(
    `INSERT INTO user_notification_prefs (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
     RETURNING user_id, digest_enabled, digest_frequency, last_digest_at`,
    [userId],
  );
  const row = r.rows[0];
  return {
    userId: row.user_id,
    digestEnabled: row.digest_enabled,
    digestFrequency: row.digest_frequency,
    lastDigestAt: row.last_digest_at,
  };
}

/**
 * Update notification preferences for a user.
 */
export async function updatePrefs(
  userId: string,
  prefs: { digestEnabled?: boolean; digestFrequency?: "weekly" | "never" },
): Promise<void> {
  const sets: string[] = ["updated_at = NOW()"];
  const vals: any[] = [];
  let i = 1;

  if (prefs.digestEnabled !== undefined) {
    sets.push(`digest_enabled = $${i}`);
    vals.push(prefs.digestEnabled);
    i++;
  }
  if (prefs.digestFrequency !== undefined) {
    sets.push(`digest_frequency = $${i}`);
    vals.push(prefs.digestFrequency);
    i++;
  }

  vals.push(userId);

  await sql.query(
    `UPDATE user_notification_prefs SET ${sets.join(", ")} WHERE user_id = $${i}`,
    vals,
  );
}

/* ------------------------------------------------------------------ */
/*  digest eligibility                                                 */
/* ------------------------------------------------------------------ */

/**
 * Users eligible for a digest right now:
 * - email_verified = true
 * - digest_enabled = true (or no prefs row yet → default enabled)
 * - last_digest_at is NULL or > 6 days ago (safety margin for weekly)
 */
export async function getDigestEligibleUsers(): Promise<DigestUser[]> {
  const r = await sql.query(`
    SELECT u.id, u.email, u.name, np.last_digest_at
    FROM users u
    LEFT JOIN user_notification_prefs np ON np.user_id = u.id
    WHERE u.email_verified = TRUE
      AND COALESCE(np.digest_enabled, TRUE) = TRUE
      AND COALESCE(np.digest_frequency, 'weekly') = 'weekly'
      AND (np.last_digest_at IS NULL OR np.last_digest_at < NOW() - INTERVAL '6 days')
  `);
  return r.rows.map((row: any) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    lastDigestAt: row.last_digest_at,
  }));
}

/* ------------------------------------------------------------------ */
/*  digest content                                                     */
/* ------------------------------------------------------------------ */

/**
 * Compile digest content for a single user since a given date.
 * Falls back to 7 days ago if no date provided.
 */
export async function getDigestContent(
  userId: string,
  since: string | null,
): Promise<DigestContent> {
  const sinceDate = since ?? new Date(Date.now() - 7 * 86400_000).toISOString();

  // Run all queries in parallel
  const [newPlaydates, recentReflections, evidenceCount, progressChanges, untried] =
    await Promise.all([
      // 1. New playdates added to the catalogue
      sql.query(
        `SELECT title, slug, headline
         FROM playdates_cache
         WHERE synced_at > $1 AND status = 'published'
         ORDER BY synced_at DESC
         LIMIT 5`,
        [sinceDate],
      ),

      // 2. User's recent reflections count
      sql.query(
        `SELECT COUNT(*)::int AS count
         FROM runs_cache
         WHERE created_by = $1 AND synced_at > $2`,
        [userId, sinceDate],
      ),

      // 3. Evidence items added
      sql.query(
        `SELECT COUNT(*)::int AS count
         FROM run_evidence re
         JOIN runs_cache r ON r.id = re.run_id
         WHERE r.created_by = $1 AND re.created_at > $2`,
        [userId, sinceDate],
      ),

      // 4. Progress tier changes
      sql.query(
        `SELECT pc.title AS playdate_title, pp.progress_tier AS tier
         FROM playdate_progress pp
         JOIN playdates_cache pc ON pc.id = pp.playdate_id
         WHERE pp.user_id = $1 AND pp.updated_at > $2
         ORDER BY pp.updated_at DESC
         LIMIT 5`,
        [userId, sinceDate],
      ),

      // 5. Collection playdates user hasn't tried yet (up to 3 suggestions)
      sql.query(
        `SELECT pc.title, pc.slug, c.title AS collection_title
         FROM collection_playdates cp
         JOIN playdates_cache pc ON pc.id = cp.playdate_id
         JOIN collections c ON c.id = cp.collection_id
         WHERE c.status = 'published'
           AND pc.status = 'published'
           AND NOT EXISTS (
             SELECT 1 FROM playdate_progress pp
             WHERE pp.user_id = $1 AND pp.playdate_id = cp.playdate_id
           )
         ORDER BY RANDOM()
         LIMIT 3`,
        [userId],
      ),
    ]);

  const content: DigestContent = {
    newPlaydates: newPlaydates.rows.map((r: any) => ({
      title: r.title,
      slug: r.slug,
      headline: r.headline,
    })),
    recentReflections: recentReflections.rows[0]?.count ?? 0,
    evidenceCount: evidenceCount.rows[0]?.count ?? 0,
    progressChanges: progressChanges.rows.map((r: any) => ({
      playdateTitle: r.playdate_title,
      tier: r.tier,
    })),
    untried: untried.rows.map((r: any) => ({
      title: r.title,
      slug: r.slug,
      collectionTitle: r.collection_title,
    })),
    isEmpty: false,
  };

  content.isEmpty =
    content.newPlaydates.length === 0 &&
    content.recentReflections === 0 &&
    content.evidenceCount === 0 &&
    content.progressChanges.length === 0 &&
    content.untried.length === 0;

  return content;
}

/* ------------------------------------------------------------------ */
/*  mark sent                                                          */
/* ------------------------------------------------------------------ */

/**
 * Record that a digest was sent to a user. Creates pref row if needed.
 */
export async function markDigestSent(userId: string): Promise<void> {
  await sql.query(
    `INSERT INTO user_notification_prefs (user_id, last_digest_at)
     VALUES ($1, NOW())
     ON CONFLICT (user_id) DO UPDATE SET last_digest_at = NOW(), updated_at = NOW()`,
    [userId],
  );
}
