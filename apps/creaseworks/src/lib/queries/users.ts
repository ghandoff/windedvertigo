import { sql } from "@/lib/db";

export async function getUserByEmail(email: string) {
  const r = await sql.query(
    "SELECT id, email, email_verified, name, created_at, updated_at FROM users WHERE email = $1 LIMIT 1",
    [email.toLowerCase().trim()],
  );
  return r.rows[0] ?? null;
}

export async function getUserById(id: string) {
  const r = await sql.query(
    "SELECT id, email, email_verified, name, created_at, updated_at FROM users WHERE id = $1 LIMIT 1",
    [id],
  );
  return r.rows[0] ?? null;
}

export async function createUser(email: string, name?: string) {
  const r = await sql.query(
    "INSERT INTO users (email, name, email_verified) VALUES ($1, $2, FALSE) ON CONFLICT (email) DO UPDATE SET updated_at = NOW() RETURNING id, email, email_verified, name, created_at, updated_at",
    [email.toLowerCase().trim(), name ?? null],
  );
  return r.rows[0];
}

export async function isAdmin(userId: string): Promise<boolean> {
  const r = await sql.query(
    "SELECT 1 FROM admin_allowlist WHERE user_id = $1 LIMIT 1",
    [userId],
  );
  return r.rows.length > 0;
}

export async function addAdmin(userId: string, grantedBy?: string) {
  await sql.query(
    "INSERT INTO admin_allowlist (user_id, granted_by) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING",
    [userId, grantedBy ?? null],
  );
}

/* ── onboarding ── */

export interface OnboardingStatus {
  onboarding_completed: boolean;
  play_preferences: {
    age_groups?: string[];
    contexts?: string[];
    energy?: string;
  } | null;
}

export async function getUserOnboardingStatus(
  userId: string,
): Promise<OnboardingStatus | null> {
  const r = await sql.query(
    `SELECT onboarding_completed, play_preferences
       FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  return r.rows[0] ?? null;
}
