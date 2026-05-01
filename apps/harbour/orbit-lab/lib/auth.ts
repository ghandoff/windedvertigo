import { createHarbourAuth } from "@windedvertigo/auth";

const { handlers, auth, signIn, signOut, authConfig } = createHarbourAuth({
  appName: "orbit-lab",
});

export { handlers, auth, signIn, signOut, authConfig };
