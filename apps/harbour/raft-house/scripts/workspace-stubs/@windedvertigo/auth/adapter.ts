import { sql } from "@vercel/postgres";

/**
 * Shared Auth.js adapter for all harbour apps.
 *
 * Uses JWT strategy — session-based methods throw. The adapter handles
 * user CRUD, OAuth account linking, and magic-link verification tokens
 * against the shared Neon Postgres database.
 *
 * All apps must point POSTGRES_URL at the same shared database for
 * cross-app SSO to work.
 */
export const harbourAdapter = {
  async createUser(data: {
    email: string;
    name?: string | null;
    emailVerified?: Date | null;
  }) {
    const r = await sql.query(
      `INSERT INTO users (email, name, email_verified)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
       RETURNING id, email, email_verified, name`,
      [data.email.toLowerCase().trim(), data.name ?? null, !!data.emailVerified],
    );
    const row = r.rows[0];
    return {
      id: row.id,
      email: row.email,
      emailVerified: row.email_verified ? new Date() : null,
      name: row.name,
    };
  },

  async getUser(id: string) {
    const r = await sql.query(
      "SELECT id, email, email_verified, name FROM users WHERE id = $1",
      [id],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      emailVerified: row.email_verified ? new Date() : null,
      name: row.name,
    };
  },

  async getUserByEmail(email: string) {
    const r = await sql.query(
      "SELECT id, email, email_verified, name FROM users WHERE email = $1 LIMIT 1",
      [email.toLowerCase().trim()],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      emailVerified: row.email_verified ? new Date() : null,
      name: row.name,
    };
  },

  async getUserByAccount({
    provider,
    providerAccountId,
  }: {
    provider: string;
    providerAccountId: string;
  }) {
    const r = await sql.query(
      `SELECT u.id, u.email, u.email_verified, u.name
       FROM accounts a
       JOIN users u ON u.id = a.user_id
       WHERE a.provider = $1 AND a.provider_account_id = $2
       LIMIT 1`,
      [provider, providerAccountId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      emailVerified: row.email_verified ? new Date() : null,
      name: row.name,
    };
  },

  async updateUser(data: { id: string; name?: string | null }) {
    if (data.name) {
      await sql.query(
        "UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2",
        [data.name, data.id],
      );
    }
    const r = await sql.query(
      "SELECT id, email, email_verified, name FROM users WHERE id = $1",
      [data.id],
    );
    const row = r.rows[0];
    if (!row) throw new Error(`updateUser: user ${data.id} not found`);
    return {
      id: row.id,
      email: row.email,
      emailVerified: row.email_verified ? new Date() : null,
      name: row.name,
    };
  },

  async linkAccount(data: {
    userId: string;
    provider: string;
    providerAccountId: string;
    type: string;
    [key: string]: unknown;
  }) {
    await sql.query(
      `INSERT INTO accounts (user_id, provider, provider_account_id, type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider, provider_account_id) DO NOTHING`,
      [data.userId, data.provider, data.providerAccountId, data.type],
    );
    return undefined;
  },

  async createSession() {
    throw new Error("not used with jwt strategy");
  },
  async getSessionAndUser() {
    throw new Error("not used with jwt strategy");
  },
  async updateSession() {
    throw new Error("not used with jwt strategy");
  },
  async deleteSession() {},

  async createVerificationToken(data: {
    identifier: string;
    token: string;
    expires: Date;
  }) {
    await sql.query(
      "INSERT INTO verification_token (identifier, token, expires) VALUES ($1, $2, $3)",
      [data.identifier, data.token, data.expires],
    );
    return data;
  },

  async useVerificationToken(data: { identifier: string; token: string }) {
    const r = await sql.query(
      "DELETE FROM verification_token WHERE identifier = $1 AND token = $2 RETURNING identifier, token, expires",
      [data.identifier, data.token],
    );
    return r.rows[0] ?? null;
  },
};
