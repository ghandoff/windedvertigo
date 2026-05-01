import { createHarbourAuth } from "@windedvertigo/auth";

/**
 * Paper-trail auth — uses the shared harbour auth package.
 * Shares cookies with all harbour apps on .windedvertigo.com.
 */
const { handlers, auth, signIn, signOut, authConfig } = createHarbourAuth({
  appName: "paper-trail",
});

export { handlers, auth, signIn, signOut, authConfig };
