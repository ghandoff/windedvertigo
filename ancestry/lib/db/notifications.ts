/**
 * Notification-related database queries.
 *
 * Handles the notification queue (debounced immediate emails),
 * preferences (opt-in/out), and send tracking (digest dedup).
 */

import { getDb } from "./index";
import type { ActivityEntry } from "./queries";

// ─── queue ───────────────────────────────────────────────────

/** upsert a queue row after any tree edit (called from logActivity) */
export async function enqueueNotification(
  treeId: string,
  actorEmail: string
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO notification_queue (tree_id, last_actor_email)
    VALUES (${treeId}, ${actorEmail})
    ON CONFLICT (tree_id) DO UPDATE SET
      last_activity_at = now(),
      last_actor_email = ${actorEmail},
      activity_count = notification_queue.activity_count + 1
  `;
}

export type PendingNotification = {
  tree_id: string;
  tree_name: string;
  owner_email: string;
  first_activity_at: string;
  last_actor_email: string | null;
  activity_count: number;
};

/** get queue rows where the debounce window has elapsed */
export async function getPendingNotifications(
  debounceMinutes = 5
): Promise<PendingNotification[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      q.tree_id,
      t.name AS tree_name,
      t.owner_email,
      q.first_activity_at,
      q.last_actor_email,
      q.activity_count
    FROM notification_queue q
    JOIN trees t ON t.id = q.tree_id
    WHERE q.last_activity_at < now() - make_interval(mins => ${debounceMinutes})
  `;
  return rows as PendingNotification[];
}

/** clear the queue for a tree after sending */
export async function clearNotificationQueue(treeId: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM notification_queue WHERE tree_id = ${treeId}`;
}

// ─── activity fetch ──────────────────────────────────────────

/** get activity entries for a tree since a given timestamp */
export async function getActivitySince(
  treeId: string,
  since: Date
): Promise<ActivityEntry[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, tree_id, actor_email, action, target_type, target_id,
           target_name, details, created_at
    FROM activity_log
    WHERE tree_id = ${treeId}
      AND created_at >= ${since.toISOString()}
    ORDER BY created_at ASC
  `;
  return rows as ActivityEntry[];
}

// ─── recipients ──────────────────────────────────────────────

export type NotificationRecipient = {
  email: string;
  tree_name: string;
};

/**
 * Get all emails that should receive notifications for a tree.
 * Includes owner + members, filtered by preference.
 * Excludes the actor who triggered the notification.
 */
export async function getNotificationRecipients(
  treeId: string,
  prefKey: "immediate" | "digest",
  excludeEmail?: string
): Promise<NotificationRecipient[]> {
  const sql = getDb();
  // union owner + members, left join prefs (default true if no row)
  const rows = await sql`
    WITH all_members AS (
      SELECT t.owner_email AS email, t.name AS tree_name
      FROM trees t WHERE t.id = ${treeId}
      UNION
      SELECT tm.member_email AS email, t.name AS tree_name
      FROM tree_members tm
      JOIN trees t ON t.id = tm.tree_id
      WHERE tm.tree_id = ${treeId}
    )
    SELECT am.email, am.tree_name
    FROM all_members am
    LEFT JOIN notification_prefs np
      ON np.tree_id = ${treeId} AND np.email = am.email
    WHERE (${excludeEmail ?? null}::text IS NULL OR am.email != ${excludeEmail ?? null})
      AND COALESCE(
        CASE WHEN ${prefKey} = 'immediate' THEN np.immediate ELSE np.digest END,
        true
      ) = true
  `;
  return rows as NotificationRecipient[];
}

// ─── preferences ─────────────────────────────────────────────

export type NotificationPrefs = {
  immediate: boolean;
  digest: boolean;
};

export async function getNotificationPrefs(
  treeId: string,
  email: string
): Promise<NotificationPrefs> {
  const sql = getDb();
  const rows = await sql`
    SELECT immediate, digest
    FROM notification_prefs
    WHERE tree_id = ${treeId} AND email = ${email}
  `;
  if (rows.length === 0) return { immediate: true, digest: true };
  return { immediate: rows[0].immediate, digest: rows[0].digest };
}

export async function upsertNotificationPrefs(
  treeId: string,
  email: string,
  prefs: { immediate?: boolean; digest?: boolean }
): Promise<void> {
  const sql = getDb();
  const imm = prefs.immediate ?? true;
  const dig = prefs.digest ?? true;
  await sql`
    INSERT INTO notification_prefs (tree_id, email, immediate, digest)
    VALUES (${treeId}, ${email}, ${imm}, ${dig})
    ON CONFLICT (tree_id, email) DO UPDATE SET
      immediate = ${imm},
      digest = ${dig},
      updated_at = now()
  `;
}

// ─── send tracking (digest dedup) ────────────────────────────

export async function recordNotificationSend(
  treeId: string,
  email: string,
  sendType: "immediate" | "digest",
  weekStart?: Date
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO notification_sends (tree_id, email, send_type, week_start)
    VALUES (${treeId}, ${email}, ${sendType}, ${weekStart?.toISOString().slice(0, 10) ?? null})
  `;
}

export async function digestAlreadySentThisWeek(
  treeId: string,
  email: string,
  weekStart: Date
): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    SELECT 1 FROM notification_sends
    WHERE tree_id = ${treeId}
      AND email = ${email}
      AND send_type = 'digest'
      AND week_start = ${weekStart.toISOString().slice(0, 10)}
    LIMIT 1
  `;
  return rows.length > 0;
}

// ─── helpers ─────────────────────────────────────────────────

/** get monday of the current ISO week */
export function getWeekStart(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

/** get all tree IDs with activity since a given date */
export async function getActiveTreeIds(since: Date): Promise<string[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT DISTINCT tree_id FROM activity_log
    WHERE created_at >= ${since.toISOString()}
  `;
  return rows.map((r) => r.tree_id as string);
}
