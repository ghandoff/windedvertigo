import { createHarbourAuth } from "@windedvertigo/auth";

/**
 * Depth-chart auth — uses the shared harbour auth package with
 * no app-specific enrichment (no org/role/tier system yet).
 *
 * Shares cookies with creaseworks and vertigo-vault on
 * .windedvertigo.com — signing in on any harbour app
 * authenticates you here too.
 */
const { handlers, auth, signIn, signOut, authConfig } = createHarbourAuth({
  appName: "depth-chart",
});

export { handlers, auth, signIn, signOut, authConfig };
