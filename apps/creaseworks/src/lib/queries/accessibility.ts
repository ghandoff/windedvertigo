/**
 * Accessibility preferences — reduce motion, dyslexia font.
 *
 * App-level toggles that supplement OS settings. Stored in the users
 * table and mirrored to cookies for instant CSS application on page load.
 */

import { sql } from "@/lib/db";

export interface AccessibilityPrefs {
  reduceMotion: boolean;
  dyslexiaFont: boolean;
}

const DEFAULT_PREFS: AccessibilityPrefs = {
  reduceMotion: false,
  dyslexiaFont: false,
};

/**
 * Get accessibility preferences for a user.
 * Returns defaults if user not found or columns are null.
 */
export async function getAccessibilityPrefs(
  userId: string,
): Promise<AccessibilityPrefs> {
  const r = await sql.query(
    `SELECT reduce_motion, dyslexia_font
     FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  if (!r.rows[0]) return DEFAULT_PREFS;
  return {
    reduceMotion: r.rows[0].reduce_motion ?? false,
    dyslexiaFont: r.rows[0].dyslexia_font ?? false,
  };
}

/**
 * Update accessibility preferences for a user.
 * Only updates the fields provided.
 */
export async function updateAccessibilityPrefs(
  userId: string,
  prefs: Partial<AccessibilityPrefs>,
): Promise<AccessibilityPrefs> {
  const sets: string[] = [];
  const values: (string | boolean)[] = [];
  let idx = 1;

  if (prefs.reduceMotion !== undefined) {
    sets.push(`reduce_motion = $${++idx}`);
    values.push(prefs.reduceMotion);
  }
  if (prefs.dyslexiaFont !== undefined) {
    sets.push(`dyslexia_font = $${++idx}`);
    values.push(prefs.dyslexiaFont);
  }

  if (sets.length === 0) return getAccessibilityPrefs(userId);

  const r = await sql.query(
    `UPDATE users
     SET ${sets.join(", ")}, updated_at = NOW()
     WHERE id = $1
     RETURNING reduce_motion, dyslexia_font`,
    [userId, ...values],
  );

  if (!r.rows[0]) return DEFAULT_PREFS;
  return {
    reduceMotion: r.rows[0].reduce_motion ?? false,
    dyslexiaFont: r.rows[0].dyslexia_font ?? false,
  };
}
