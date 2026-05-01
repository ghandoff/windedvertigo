/**
 * Shared cookie config for harbour SSO.
 *
 * All harbour apps set cookies on `.windedvertigo.com` with path=/
 * so signing in on any app authenticates you on all others.
 * The cookie names are identical across apps — the JWT is signed
 * with the same AUTH_SECRET.
 */

const isProduction = () => process.env.NODE_ENV === "production";
const domain = () => (isProduction() ? ".windedvertigo.com" : undefined);

export const harbourCookies = {
  sessionToken: {
    name: "authjs.session-token",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: isProduction(),
      domain: domain(),
    },
  },
  callbackUrl: {
    name: "authjs.callback-url",
    options: {
      sameSite: "lax" as const,
      path: "/",
      secure: isProduction(),
      domain: domain(),
    },
  },
  csrfToken: {
    name: "authjs.csrf-token",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: isProduction(),
      domain: domain(),
    },
  },
};
