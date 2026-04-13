/**
 * Shared Auth.js v5 configuration — Google SSO.
 *
 * Access is granted to:
 * 1. Any @windedvertigo.com Google Workspace account (domain check)
 * 2. Specific external emails listed in ALLOWED_EMAILS env var
 *
 * The signIn callback enforces both checks server-side.
 *
 * Usage in each app:
 *   import { handlers, auth, signIn, signOut } from "@windedvertigo/auth";
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { neon } from "@neondatabase/serverless";

const ALLOWED_DOMAIN = "windedvertigo.com";

/**
 * Check if an email appears in any tree_members row (ancestry app).
 * Uses @neondatabase/serverless for a one-shot query — no connection pool.
 * Fails silently if DATABASE_URL is unset or the table doesn't exist,
 * so non-ancestry apps are unaffected.
 */
async function isTreeMember(email: string): Promise<boolean> {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return false;
    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT 1 FROM tree_members WHERE member_email = ${email} LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}

/** Parse comma-separated email allowlist from env, lowercased and trimmed. */
const ALLOWED_EMAILS = new Set(
  (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  basePath: "/api/auth",

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // No prompt override — Google will silently reuse the active session
      // when only one account is signed in, avoiding an unnecessary picker.
      // The picker still appears naturally when multiple accounts are present.
    }),
  ],

  // Cookie config: ensure cookies are scoped to the proxy domain (www.windedvertigo.com)
  // not the backend Vercel domain. Without this, PKCE state cookies set on the
  // proxy target don't get sent back on the Google callback, causing 400 errors.
  //
  // IMPORTANT: sessionToken must include maxAge matching session.maxAge.
  // Without it the browser treats it as a session cookie and deletes it on close.
  cookies: {
    pkceCodeVerifier: {
      name: "authjs.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    state: {
      name: "authjs.state",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: "authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    sessionToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 90 * 24 * 60 * 60, // 90 days — must match session.maxAge
      },
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 90 * 24 * 60 * 60, // 90 days — persistent across app reopens
    updateAge: 24 * 60 * 60,   // refresh token silently every 24 hours
  },

  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email) return false;

      // Allow windedvertigo.com domain
      if (email.endsWith(`@${ALLOWED_DOMAIN}`)) return true;

      // Allow specific external emails
      if (ALLOWED_EMAILS.has(email)) return true;

      // Allow anyone invited to a tree (ancestry app)
      // Gracefully skips if tree_members table doesn't exist (other apps)
      if (await isTreeMember(email)) return true;

      return false;
    },

    jwt({ token, profile }) {
      // Store first name from Google profile for "logged by" auto-fill
      if (profile?.given_name) {
        token.firstName = profile.given_name.toLowerCase();
      }
      if (profile?.email) {
        token.email = profile.email;
      }
      return token;
    },

    session({ session, token }) {
      // Expose first name + email to client session
      if (token.firstName) {
        (session as unknown as Record<string, unknown>).firstName = token.firstName;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
});
