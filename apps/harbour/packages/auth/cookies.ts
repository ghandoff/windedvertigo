/**
 * Shared cookie config for harbour SSO.
 *
 * All harbour apps set cookies on `.windedvertigo.com` with path=/
 * so signing in on any app authenticates you on all others.
 * The cookie names are identical across apps — the JWT is signed
 * with the same AUTH_SECRET.
 *
 * We pin ALL auth-flow cookies (including PKCE, state, nonce) to
 * `.windedvertigo.com`. Without this, Auth.js defaults leave them
 * host-scoped. Because the harbour hub's AUTH_URL uses www.windedvertigo.com
 * but the sign-in form is often reached via windedvertigo.com (no www),
 * PKCE/state cookies set for windedvertigo.com are not sent to
 * www.windedvertigo.com on the OAuth callback → CallbackRouteError →
 * ?error=Configuration.
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
  // PKCE, state, and nonce cookies must also be domain-scoped so they survive
  // a www ↔ non-www host switch between the signin redirect and the callback.
  pkceCodeVerifier: {
    name: "authjs.pkce.code_verifier",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: isProduction(),
      domain: domain(),
      maxAge: 60 * 15,
    },
  },
  state: {
    name: "authjs.state",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: isProduction(),
      domain: domain(),
      maxAge: 60 * 15,
    },
  },
  nonce: {
    name: "authjs.nonce",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: isProduction(),
      domain: domain(),
    },
  },
};
