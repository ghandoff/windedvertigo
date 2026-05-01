import { createHarbourAuth } from "@windedvertigo/auth";

const { handlers, auth, signIn, signOut, authConfig } = createHarbourAuth({
  appName: "proof-garden",
});

export { handlers, auth, signIn, signOut, authConfig };
