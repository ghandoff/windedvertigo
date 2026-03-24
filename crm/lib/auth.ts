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

  callbacks: {
    signIn({ profile }) {
      // Server-side domain check — hd param only restricts the picker UI
      if (!profile?.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return false;
      }
      return true;
    },

    session({ session }) {
      return session;
    },
  },

  pages: {
    signIn: "/crm/login",
    error: "/crm/login",
  },
});
