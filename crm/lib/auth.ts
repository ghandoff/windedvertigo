/**
 * Auth.js v5 configuration — Google Workspace SSO.
 *
 * Only @windedvertigo.com Google accounts can sign in.
 * The `hd` (hosted domain) param restricts the Google sign-in picker,
 * and the signIn callback double-checks the domain server-side.
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWED_DOMAIN = "windedvertigo.com";

export const { handlers, auth, signIn, signOut } = NextAuth({
  basePath: "/crm/api/auth",

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          hd: ALLOWED_DOMAIN,
          prompt: "select_account",
        },
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 90 * 24 * 60 * 60, // 90 days — persistent across app reopens
    updateAge: 24 * 60 * 60,   // refresh token silently every 24 hours
  },

  callbacks: {
    signIn({ profile }) {
      // Server-side domain check — hd param only restricts the picker UI
      if (!profile?.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return false;
      }
      return true;
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
