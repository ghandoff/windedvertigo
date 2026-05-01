import { createHarbourAuth } from "@windedvertigo/auth";

const { handlers, auth, signIn, signOut, authConfig } = createHarbourAuth({
  appName: "bias-lens",
});

export { handlers, auth, signIn, signOut, authConfig };
