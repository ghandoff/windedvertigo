import { createHarbourAuth } from "@windedvertigo/auth";

const { handlers, auth, signIn, signOut, authConfig } = createHarbourAuth({
  appName: "liminal-pass",
});

export { handlers, auth, signIn, signOut, authConfig };
