/**
 * Auth.js v5 configuration — Google SSO.
 *
 * Access is granted to:
 * 1. Any @windedvertigo.com Google Workspace account (domain check)
 * 2. Specific external emails listed in ALLOWED_EMAILS env var
 *
 * The signIn callback enforces both checks server-side.
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWED_DOMAIN = "windedvertigo.com";

/** Parse comma-separated email allowlist from env, lowercased and trimmed. */
const ALLOWED_EMAILS = new Set(
  (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  basePath: "/crm/api/auth",

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // No `hd` restriction — external guests need to see the picker
          prompt: "select_account",
        },
      },
    }),
  ],

  // Cookie config: ensure cookies are scoped to the proxy domain (www.windedvertigo.com)
  // not the backend Vercel domain. Without this, PKCE state cookies set on the
  // proxy target don't get sent back on the Google callback, causing 400 errors.
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
      },
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 90 * 24 * 60 * 60, // 90 days — persistent across app reopens
    updateAge: 24 * 60 * 60,   // refresh token silently every 24 hours
  },

  callbacks: {
    signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email) return false;

      // Allow windedvertigo.com domain
      if (email.endsWith(`@${ALLOWED_DOMAIN}`)) return true;

      // Allow specific external emails
      if (ALLOWED_EMAILS.has(email)) return true;

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
    signIn: "/crm/login",
    error: "/crm/login",
  },
});
