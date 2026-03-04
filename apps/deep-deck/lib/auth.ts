import NextAuth, { type NextAuthConfig } from "next-auth";
import Resend from "next-auth/providers/resend";
import Google from "next-auth/providers/google";
import { sql } from "@/lib/db";
import { getUserByEmail, createUser, getUserById, updateUser } from "@/lib/queries/users";
import { getUserPacks } from "@/lib/queries/entitlements";
import type { PackId } from "@/lib/types";

export const authConfig: NextAuthConfig = {
  basePath: "/reservoir/deep-deck/api/auth",

  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? "noreply@windedvertigo.com",
    }),
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],

  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=1",
    error: "/login",
  },

  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },

  adapter: {
    async createUser(user) {
      const dbUser = await createUser(user.email!, user.name ?? undefined);
      return { id: dbUser.id, email: dbUser.email, emailVerified: null, name: dbUser.name, image: dbUser.image };
    },
    async getUser(id) {
      const dbUser = await getUserById(id);
      if (!dbUser) return null;
      return { id: dbUser.id, email: dbUser.email, emailVerified: null, name: dbUser.name, image: dbUser.image };
    },
    async getUserByEmail(email) {
      const dbUser = await getUserByEmail(email);
      if (!dbUser) return null;
      return { id: dbUser.id, email: dbUser.email, emailVerified: null, name: dbUser.name, image: dbUser.image };
    },
    async getUserByAccount({ provider, providerAccountId }) {
      const result = await sql`
        SELECT u.* FROM users u
        JOIN accounts a ON a.user_id = u.id
        WHERE a.provider = ${provider}
          AND a.provider_account_id = ${providerAccountId}
        LIMIT 1
      `;
      const row = result.rows[0];
      if (!row) return null;
      return { id: row.id, email: row.email, emailVerified: null, name: row.name, image: row.image };
    },
    async updateUser(user) {
      if (user.id) {
        await updateUser(user.id, {
          name: user.name ?? undefined,
          image: user.image ?? undefined,
        });
      }
      return user as any;
    },
    async linkAccount(account) {
      await sql`
        INSERT INTO accounts (user_id, provider, provider_account_id, type)
        VALUES (${account.userId}, ${account.provider}, ${account.providerAccountId}, ${account.type})
        ON CONFLICT (provider, provider_account_id) DO NOTHING
      `;
    },
    async createVerificationToken(token) {
      await sql`
        INSERT INTO verification_token (identifier, token, expires)
        VALUES (${token.identifier}, ${token.token}, ${token.expires.toISOString()})
      `;
      return token;
    },
    async useVerificationToken({ identifier, token }) {
      const result = await sql`
        DELETE FROM verification_token
        WHERE identifier = ${identifier} AND token = ${token}
        RETURNING *
      `;
      const row = result.rows[0];
      if (!row) return null;
      return { identifier: row.identifier, token: row.token, expires: new Date(row.expires) };
    },
  },

  callbacks: {
    async jwt({ token, user, account }) {
      // On initial sign-in, store userId
      if (user?.id) {
        token.userId = user.id;
      }

      // Mark email as verified on OAuth sign-in
      if (account?.provider === "google" && token.userId) {
        await updateUser(token.userId as string, { email_verified: true });
      }

      // Load packs (refresh every 5 minutes)
      const lastRefresh = (token.refreshedAt as number) || 0;
      const now = Date.now();
      if (token.userId && now - lastRefresh > 5 * 60 * 1000) {
        try {
          const packs = await getUserPacks(token.userId as string);
          token.packs = packs;
          token.hasFullDeck = packs.includes("full");
        } catch {
          // Keep stale data if DB is temporarily unavailable
        }
        token.refreshedAt = now;
      }

      return token;
    },

    async session({ session, token }) {
      return {
        ...session,
        userId: token.userId as string,
        packs: (token.packs as PackId[]) || ["sampler"],
        hasFullDeck: (token.hasFullDeck as boolean) || false,
      };
    },
  },
};

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(authConfig);

/** Get the current session, or null. */
export async function getSession() {
  return auth();
}
