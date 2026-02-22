import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import Google from "next-auth/providers/google";
import { sql } from "@/lib/db";
import {
  getUserByEmail,
  createUser,
  isAdmin,
  addAdmin,
} from "@/lib/queries/users";
import {
  autoJoinOrg,
  getOrgMembership,
} from "@/lib/queries/organisations";

// The verification_token table is created by migration 011.
// Previously this module ran CREATE TABLE IF NOT EXISTS on every cold
// start — removed in audit fix #12.

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? "noreply@windedvertigo.com",
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=1",
    error: "/login",
  },

  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },

  adapter: {
    async createUser(data: { email: string; name?: string | null; emailVerified?: Date | null }) {
      const user = await createUser(data.email!, data.name ?? undefined);
      return {
        id: user.id,
        email: user.email,
        emailVerified: user.email_verified ? new Date() : null,
        name: user.name,
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
      const row = await getUserByEmail(email);
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
      // For OAuth providers, match by email stored during linkAccount.
      // We store provider:providerAccountId → user mapping in a lightweight way
      // by looking up the account in our accounts table.
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
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;

      // Sync name from Google profile if we don't have one yet
      if (account?.provider === "google" && profile?.name && user.id) {
        const existing = await sql.query(
          "SELECT name FROM users WHERE id = $1",
          [user.id],
        );
        if (existing.rows[0] && !existing.rows[0].name) {
          await sql.query(
            "UPDATE users SET name = $1, email_verified = TRUE, updated_at = NOW() WHERE id = $2",
            [profile.name, user.id],
          );
        }
      }

      // Mark email as verified after successful sign-in
      // (Google OAuth proves email ownership; Resend magic-link proves it too)
      if (user.id) {
        await sql.query(
          "UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1 AND email_verified = FALSE",
          [user.id],
        );
      }

      if (user.id) await autoJoinOrg(user.id, user.email);
      const adm = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase().trim();
      if (adm && user.email.toLowerCase().trim() === adm && user.id) {
        if (!(await isAdmin(user.id))) {
          await addAdmin(user.id);
          console.log("bootstrapped initial admin:", user.email);
        }
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user?.id) {
        // Initial sign-in — populate all fields
        token.userId = user.id;
        token.email = user.email;
        const m = await getOrgMembership(user.id);
        token.orgId = m?.org_id ?? null;
        token.orgName = m?.org_name ?? null;
        token.orgRole = m?.role ?? null;
        token.isAdmin = await isAdmin(user.id);
        token.refreshedAt = Date.now();
      } else if (token.userId) {
        // Subsequent requests — refresh org/role data every 5 minutes so
        // role changes, org joins, and admin revocations take effect without
        // waiting for the full 7-day session expiry.
        const refreshedAt = (token.refreshedAt as number) || 0;
        const fiveMinutes = 5 * 60 * 1000;
        if (Date.now() - refreshedAt > fiveMinutes) {
          try {
            const m = await getOrgMembership(token.userId as string);
            token.orgId = m?.org_id ?? null;
            token.orgName = m?.org_name ?? null;
            token.orgRole = m?.role ?? null;
            token.isAdmin = await isAdmin(token.userId as string);
            token.refreshedAt = Date.now();
          } catch (err) {
            // If DB is temporarily unavailable, keep stale token rather
            // than breaking the session. Will retry on next request.
            console.error("jwt refresh failed, using stale token:", err);
          }
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string;
        session.userId = token.userId;
        session.orgId = token.orgId;
        session.orgName = token.orgName;
        session.orgRole = token.orgRole;
        session.isAdmin = token.isAdmin;
      }
      return session;
    },
  },
});
