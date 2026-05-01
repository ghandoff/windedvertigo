import { createHarbourAuth } from "@windedvertigo/auth";

/**
 * Tidal-pool auth — uses the shared harbour auth package.
 * Shares cookies with all harbour apps on .windedvertigo.com.
 */
const { handlers, auth, signIn, signOut, authConfig } = createHarbourAuth({
  appName: "tidal-pool",
});

export { handlers, auth, signIn, signOut, authConfig };
