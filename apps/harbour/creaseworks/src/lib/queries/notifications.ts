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
  digestFrequency: "weekly" | "biweekly" | "never";
  lastDigestAt: string | null;
  nudgeEnabled?: boolean;
  lastNudgeAt?: string | null;
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
     RETURNING user_id, digest_enabled, digest_frequency, last_digest_at, nudge_enabled, last_nudge_sent_at`,
    [userId],
  );
  const row = r.rows[0];
  return {
    userId: row.user_id,
    digestEnabled: row.digest_enabled,
    digestFrequency: row.digest_frequency as "weekly" | "biweekly" | "never",
    lastDigestAt: row.last_digest_at,
    nudgeEnabled: row.nudge_enabled ?? true,
    lastNudgeAt: row.last_nudge_sent_at,
  };
}

/**
 * Update notification preferences for a user.
 */
export async function updatePrefs(
  userId: string,
  prefs: {
    digestEnabled?: boolean;
    digestFrequency?: "weekly" | "biweekly" | "never";
    nudgeEnabled?: boolean;
  },
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
  if (prefs.nudgeEnabled !== undefined) {
    sets.push(`nudge_enabled = $${i}`);
    vals.push(prefs.nudgeEnabled);
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
 * - Frequency-specific eligibility:
 *   - weekly: last_digest_at is NULL or > 6 days ago
 *   - biweekly: last_digest_at is NULL or > 13 days ago
 */
export async function getDigestEligibleUsers(): Promise<DigestUser[]> {
  const r = await sql.query(`
    SELECT u.id, u.email, u.name, np.last_digest_at, COALESCE(np.digest_frequency, 'weekly') AS freq
    FROM users u
    LEFT JOIN user_notification_prefs np ON np.user_id = u.id
    WHERE u.email_verified = TRUE
      AND COALESCE(np.digest_enabled, TRUE) = TRUE
      AND COALESCE(np.digest_frequency, 'weekly') IN ('weekly', 'biweekly')
      AND (
        (COALESCE(np.digest_frequency, 'weekly') = 'weekly' AND (np.last_digest_at IS NULL OR np.last_digest_at < NOW() - INTERVAL '6 days'))
        OR
        (np.digest_frequency = 'biweekly' AND (np.last_digest_at IS NULL OR np.last_digest_at < NOW() - INTERVAL '13 days'))
      )
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

/* ------------------------------------------------------------------ */
/*  nudge / re-engagement emails                                       */
/* ------------------------------------------------------------------ */

export interface NudgeUser {
  id: string;
  email: string;
  name: string | null;
  daysInactive: number;
}

/**
 * Users eligible for a nudge email:
 * - email_verified = true
 * - nudge_enabled = true
 * - last_active_at is more than 14 days ago
 * - last_nudge_sent_at is null or more than 7 days ago (don't spam)
 */
export async function getNudgeEligibleUsers(): Promise<NudgeUser[]> {
  const r = await sql.query(`
    SELECT
      u.id,
      u.email,
      u.name,
      EXTRACT(DAY FROM NOW() - COALESCE(u.last_active_at, u.created_at))::int AS days_inactive
    FROM users u
    LEFT JOIN user_notification_prefs np ON np.user_id = u.id
    WHERE u.email_verified = TRUE
      AND COALESCE(np.nudge_enabled, TRUE) = TRUE
      AND COALESCE(u.last_active_at, u.created_at) < NOW() - INTERVAL '14 days'
      AND (np.last_nudge_sent_at IS NULL OR np.last_nudge_sent_at < NOW() - INTERVAL '7 days')
    ORDER BY u.created_at ASC
    LIMIT 100
  `);
  return r.rows.map((row: any) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    daysInactive: row.days_inactive,
  }));
}

/**
 * Get a single untried playdate recommendation for a nudge email.
 * Tries to pick something accessible (shorter, common materials).
 */
export async function getNudgeRecommendation(
  userId: string,
): Promise<{ title: string; slug: string; headline: string | null } | null> {
  const r = await sql.query(
    `SELECT pc.title, pc.slug, pc.headline
     FROM playdates_cache pc
     WHERE pc.status = 'published'
       AND NOT EXISTS (
         SELECT 1 FROM playdate_progress pp
         WHERE pp.user_id = $1 AND pp.playdate_id = pc.id
       )
     ORDER BY RANDOM()
     LIMIT 1`,
    [userId],
  );
  if (!r.rows[0]) return null;
  const row = r.rows[0];
  return {
    title: row.title,
    slug: row.slug,
    headline: row.headline,
  };
}

/**
 * Record that a nudge email was sent to a user.
 */
export async function markNudgeSent(userId: string): Promise<void> {
  await sql.query(
    `INSERT INTO user_notification_prefs (user_id, last_nudge_sent_at)
     VALUES ($1, NOW())
     ON CONFLICT (user_id) DO UPDATE SET last_nudge_sent_at = NOW(), updated_at = NOW()`,
    [userId],
  );
}

/**
 * Update last_active_at for a user (called from activity endpoints).
 */
export async function updateLastActive(userId: string): Promise<void> {
  await sql.query(`UPDATE users SET last_active_at = NOW() WHERE id = $1`, [
    userId,
  ]);
}

/* ================================================================== */
/*  IN-APP NOTIFICATION CENTER                                         */
/*  Session 47: bell icon + dropdown notifications                      */
/* ================================================================== */

export type NotificationEventType =
  | "gallery_approved"
  | "gallery_rejected"
  | "invite_accepted"
  | "pack_granted"
  | "progress_milestone"
  | "co_play_invite"
  | "org_joined"
  | "system";

export interface InAppNotification {
  id: string;
  eventType: NotificationEventType;
  title: string;
  body: string | null;
  href: string | null;
  actorId: string | null;
  actorName: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * Fetch recent notifications for a user (paginated, newest first).
 * Includes actor name via a left join on users.
 */
export async function getUserNotifications(
  userId: string,
  opts: { limit?: number; offset?: number; unreadOnly?: boolean } = {},
): Promise<InAppNotification[]> {
  const limit = Math.min(opts.limit ?? 20, 50);
  const offset = opts.offset ?? 0;

  const unreadClause = opts.unreadOnly ? "AND n.read_at IS NULL" : "";

  const r = await sql.query(
    `SELECT
       n.id, n.event_type, n.title, n.body, n.href,
       n.actor_id, u.name AS actor_name,
       n.read_at, n.created_at
     FROM in_app_notifications n
     LEFT JOIN users u ON u.id = n.actor_id
     WHERE n.user_id = $1 ${unreadClause}
     ORDER BY n.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );

  return r.rows.map((row: any) => ({
    id: row.id,
    eventType: row.event_type as NotificationEventType,
    title: row.title,
    body: row.body,
    href: row.href,
    actorId: row.actor_id,
    actorName: row.actor_name,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

/**
 * Count unread notifications for a user.
 * Used for the badge number on the bell icon.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const r = await sql.query(
    `SELECT COUNT(*)::int AS count
     FROM in_app_notifications
     WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  );
  return r.rows[0]?.count ?? 0;
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string,
): Promise<boolean> {
  const r = await sql.query(
    `UPDATE in_app_notifications
     SET read_at = NOW()
     WHERE id = $1 AND user_id = $2 AND read_at IS NULL
     RETURNING id`,
    [notificationId, userId],
  );
  return r.rows.length > 0;
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllNotificationsRead(
  userId: string,
): Promise<number> {
  const r = await sql.query(
    `UPDATE in_app_notifications
     SET read_at = NOW()
     WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  );
  return r.rowCount ?? 0;
}

/**
 * Create an in-app notification. Uses ON CONFLICT to deduplicate
 * (same user + event_type + href won't create duplicates).
 */
export async function createInAppNotification(opts: {
  userId: string;
  eventType: NotificationEventType;
  title: string;
  body?: string;
  href?: string;
  actorId?: string;
}): Promise<string | null> {
  try {
    const r = await sql.query(
      `INSERT INTO in_app_notifications (user_id, event_type, title, body, href, actor_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, event_type, href)
         WHERE href IS NOT NULL
         DO NOTHING
       RETURNING id`,
      [
        opts.userId,
        opts.eventType,
        opts.title,
        opts.body ?? null,
        opts.href ?? null,
        opts.actorId ?? null,
      ],
    );
    return r.rows[0]?.id ?? null;
  } catch (err) {
    console.error("[notifications] createInAppNotification failed:", err);
    return null;
  }
}

/**
 * Delete old read notifications (cleanup, > 90 days).
 * Call from a cron job or maintenance script.
 */
export async function purgeOldNotifications(): Promise<number> {
  const r = await sql.query(
    `DELETE FROM in_app_notifications
     WHERE read_at IS NOT NULL AND created_at < NOW() - INTERVAL '90 days'`,
  );
  return r.rowCount ?? 0;
}
