import { createHarbourAuth } from "@windedvertigo/auth";

const { handlers, auth, signIn, signOut, authConfig } = createHarbourAuth({
  appName: "code-weave",
});

export { handlers, auth, signIn, signOut, authConfig };
