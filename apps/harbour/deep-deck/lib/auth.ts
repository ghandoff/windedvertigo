import { createHarbourAuth } from "@windedvertigo/auth";

/**
 * Deep-deck auth — uses the shared harbour auth package with no
 * app-specific enrichment. Auth is optional — deep-deck works
 * without login, but logged-in users get saved favourites and
 * cross-app navigation.
 */
const { handlers, auth, signIn, signOut, authConfig } = createHarbourAuth({
  appName: "deep-deck",
});

export { handlers, auth, signIn, signOut, authConfig };
