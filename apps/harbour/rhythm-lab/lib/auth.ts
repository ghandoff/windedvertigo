import { createHarbourAuth } from "@windedvertigo/auth";

const { handlers, auth, signIn, signOut, authConfig } = createHarbourAuth({
  appName: "rhythm-lab",
});

export { handlers, auth, signIn, signOut, authConfig };
