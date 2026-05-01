import { createHarbourAuth } from "@windedvertigo/auth";

/**
 * Harbour hub auth — uses the shared harbour auth package with no
 * app-specific enrichment yet (no org/role/tier system at the hub
 * level; those live in the nested apps that need them).
 *
 * Pass an empty `appName` because the hub mounts at `/harbour`,
 * not `/harbour/<sub>`. The shared package handles the empty case
 * by producing basePath `/harbour/api/auth`.
 *
 * Sessions share the `.windedvertigo.com` domain cookie with
 * creaseworks, vertigo-vault, and depth-chart — signing in here
 * authenticates you on those, and vice versa.
 */
const { handlers, auth, signIn, signOut, authConfig } = createHarbourAuth({
  appName: "",
});

export { handlers, auth, signIn, signOut, authConfig };
