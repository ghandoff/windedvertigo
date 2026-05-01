import { createHarbourAuth } from "@windedvertigo/auth";

const { handlers, auth, signIn, signOut, authConfig } = createHarbourAuth({
  appName: "market-mind",
});

export { handlers, auth, signIn, signOut, authConfig };
