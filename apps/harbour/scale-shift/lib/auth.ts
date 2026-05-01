import { createHarbourAuth } from "@windedvertigo/auth";

const { handlers, auth, signIn, signOut, authConfig } = createHarbourAuth({
  appName: "scale-shift",
});

export { handlers, auth, signIn, signOut, authConfig };
