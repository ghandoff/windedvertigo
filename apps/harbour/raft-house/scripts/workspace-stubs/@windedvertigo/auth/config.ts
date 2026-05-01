import NextAuth, { type NextAuthConfig } from "next-auth";
import Resend from "next-auth/providers/resend";
import Google from "next-auth/providers/google";
import { sql } from "@vercel/postgres";
import { harbourAdapter } from "./adapter";
import { harbourCookies } from "./cookies";
import type { HarbourAuthOptions } from "./types";

/**
 * Create a harbour auth config for a specific app.
 *
 * Each call returns a fresh NextAuthConfig with the shared adapter, cookies,
 * providers, and base callbacks — plus app-specific hooks injected via options.
 *
 * Usage:
 * ```ts
 * // apps/creaseworks/src/lib/auth.ts
 * import { createHarbourAuth } from "@windedvertigo/auth";
 *
 * const { auth, signIn, signOut, authConfig } = createHarbourAuth({
 *   appName: "creaseworks",
 *   onFirstSignIn: async (userId, email) => { ... },
 *   enrichToken: async (userId) => ({ orgId, orgName, ... }),
 *   refreshInterval: 300_000,
 * });
 * ```
 */
export function createHarbourAuth(options: HarbourAuthOptions) {
  const { appName, onFirstSignIn, enrichToken, refreshInterval } = options;

  const authConfig: NextAuthConfig = {
    basePath: `/harbour/${appName}/api/auth`,

    providers: [
      Resend({
        apiKey: process.env.RESEND_API_KEY,
        from: process.env.EMAIL_FROM ?? "noreply@windedvertigo.com",
      }),
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        allowDangerousEmailAccountLinking: true,
      }),
    ],

    pages: {
      signIn: "/login",
      verifyRequest: "/login?verify=1",
      error: "/login",
    },

    session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },

    cookies: harbourCookies,

    adapter: harbourAdapter,

    callbacks: {
      async signIn({ user }) {
        return !!user.email;
      },

      async jwt({ token, user, account, profile }) {
        if (user?.id) {
          // Initial sign-in — user row exists in DB at this point
          token.userId = user.id;
          token.email = user.email as string;

          // Sync name from Google profile if missing
          if (account?.provider === "google" && profile?.name) {
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

          // Mark email as verified (both Google OAuth and Resend prove ownership)
          await sql.query(
            "UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1 AND email_verified = FALSE",
            [user.id],
          );

          // App-specific first-sign-in hooks (autoJoinOrg, processInvites, etc.)
          if (onFirstSignIn) {
            await onFirstSignIn(user.id, user.email!);
          }

          // Enrich token with app-specific claims
          if (enrichToken) {
            const claims = await enrichToken(user.id);
            token.orgId = claims.orgId ?? null;
            token.orgName = claims.orgName ?? null;
            token.orgRole = claims.orgRole ?? null;
            token.isAdmin = claims.isAdmin ?? false;
            token.uiTier = claims.uiTier ?? "default";
            // Merge any extra claims
            for (const [key, val] of Object.entries(claims)) {
              if (!["orgId", "orgName", "orgRole", "isAdmin", "uiTier"].includes(key)) {
                token[key] = val;
              }
            }
          } else {
            // No enrichment — set defaults
            token.orgId = null;
            token.orgName = null;
            token.orgRole = null;
            token.isAdmin = false;
            token.uiTier = "default";
          }

          token.refreshedAt = Date.now();
        } else if (token.userId && enrichToken && refreshInterval) {
          // Subsequent requests — refresh app-specific data periodically
          const refreshedAt = (token.refreshedAt as number) || 0;
          if (Date.now() - refreshedAt > refreshInterval) {
            try {
              const claims = await enrichToken(token.userId as string);
              token.orgId = claims.orgId ?? null;
              token.orgName = claims.orgName ?? null;
              token.orgRole = claims.orgRole ?? null;
              token.isAdmin = claims.isAdmin ?? false;
              token.uiTier = claims.uiTier ?? "default";
              for (const [key, val] of Object.entries(claims)) {
                if (!["orgId", "orgName", "orgRole", "isAdmin", "uiTier"].includes(key)) {
                  token[key] = val;
                }
              }
              token.refreshedAt = Date.now();
            } catch (err) {
              // If DB is temporarily unavailable, keep stale token
              console.error(`[${appName}] jwt refresh failed, using stale token:`, err);
            }
          }
        }
        return token;
      },

      async session({ session, token }) {
        if (token) {
          session.user.id = token.userId as string;
          session.userId = token.userId as string;
          session.orgId = (token.orgId as string) ?? null;
          session.orgName = (token.orgName as string) ?? null;
          session.orgRole = (token.orgRole as string) ?? null;
          session.isAdmin = (token.isAdmin as boolean) ?? false;
          session.uiTier = (token.uiTier as string) ?? "default";
        }
        return session;
      },
    },
  };

  const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

  return { handlers, auth, signIn, signOut, authConfig };
}
