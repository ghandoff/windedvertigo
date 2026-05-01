import { createHarbourAuth } from "@windedvertigo/auth";

/**
 * Mirror-log auth — uses the shared harbour auth package.
 * Shares cookies with all harbour apps on .windedvertigo.com.
 */
const { handlers, auth, signIn, signOut, authConfig } = createHarbourAuth({
  appName: "mirror-log",
});

export { handlers, auth, signIn, signOut, authConfig };
