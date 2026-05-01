/**
 * Accessibility preferences — reduce motion, dyslexia font, calm theme.
 * Progressive disclosure tier — casual, curious, collaborator.
 *
 * App-level toggles that supplement OS settings. Stored in the users
 * table and mirrored to cookies for instant CSS application on page load.
 */

import { sql } from "@/lib/db";

export interface AccessibilityPrefs {
  reduceMotion: boolean;
  dyslexiaFont: boolean;
  calmTheme: boolean;
}

const DEFAULT_PREFS: AccessibilityPrefs = {
  reduceMotion: false,
  dyslexiaFont: false,
  calmTheme: false,
};

/**
 * Get accessibility preferences for a user.
 * Returns defaults if user not found or columns are null.
 */
export async function getAccessibilityPrefs(
  userId: string,
): Promise<AccessibilityPrefs> {
  const r = await sql.query(
    `SELECT reduce_motion, dyslexia_font, calm_theme
     FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  if (!r.rows[0]) return DEFAULT_PREFS;
  return {
    reduceMotion: r.rows[0].reduce_motion ?? false,
    dyslexiaFont: r.rows[0].dyslexia_font ?? false,
    calmTheme: r.rows[0].calm_theme ?? false,
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
  if (prefs.calmTheme !== undefined) {
    sets.push(`calm_theme = $${++idx}`);
    values.push(prefs.calmTheme);
  }

  if (sets.length === 0) return getAccessibilityPrefs(userId);

  const r = await sql.query(
    `UPDATE users
     SET ${sets.join(", ")}, updated_at = NOW()
     WHERE id = $1
     RETURNING reduce_motion, dyslexia_font, calm_theme`,
    [userId, ...values],
  );

  if (!r.rows[0]) return DEFAULT_PREFS;
  return {
    reduceMotion: r.rows[0].reduce_motion ?? false,
    dyslexiaFont: r.rows[0].dyslexia_font ?? false,
    calmTheme: r.rows[0].calm_theme ?? false,
  };
}

/* ── kid / grown-up mode ─────────────────────────────────────── */

export type UiMode = "kid" | "grownup";

const VALID_MODES: UiMode[] = ["kid", "grownup"];

export async function getUserMode(userId: string): Promise<UiMode> {
  const r = await sql.query(
    "SELECT ui_mode FROM users WHERE id = $1 LIMIT 1",
    [userId],
  );
  const mode = r.rows[0]?.ui_mode;
  return VALID_MODES.includes(mode) ? mode : "grownup";
}

export async function updateUserMode(
  userId: string,
  mode: string,
): Promise<UiMode> {
  if (!VALID_MODES.includes(mode as UiMode)) {
    throw new Error(`invalid ui mode: ${mode}`);
  }
  await sql.query(
    "UPDATE users SET ui_mode = $1, updated_at = NOW() WHERE id = $2",
    [mode, userId],
  );
  return mode as UiMode;
}

/* ── progressive disclosure tier ─────────────────────────────── */

export type UiTier = "casual" | "curious" | "collaborator";

const VALID_TIERS: UiTier[] = ["casual", "curious", "collaborator"];

/**
 * Get the user's progressive disclosure tier.
 * Returns "casual" as default if user not found.
 */
export async function getUserTier(userId: string): Promise<UiTier> {
  const r = await sql.query(
    "SELECT ui_tier FROM users WHERE id = $1 LIMIT 1",
    [userId],
  );
  const tier = r.rows[0]?.ui_tier;
  return VALID_TIERS.includes(tier) ? tier : "casual";
}

/**
 * Update the user's progressive disclosure tier.
 * Tiers are purely cosmetic — they control navigation and
 * dashboard visibility, not feature access.
 */
export async function updateUserTier(
  userId: string,
  tier: string,
): Promise<UiTier> {
  if (!VALID_TIERS.includes(tier as UiTier)) {
    throw new Error(`invalid tier: ${tier}`);
  }
  await sql.query(
    "UPDATE users SET ui_tier = $1, updated_at = NOW() WHERE id = $2",
    [tier, userId],
  );
  return tier as UiTier;
}
