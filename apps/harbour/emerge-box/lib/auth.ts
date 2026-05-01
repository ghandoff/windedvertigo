import { createHarbourAuth } from "@windedvertigo/auth";

const { handlers, auth, signIn, signOut, authConfig } = createHarbourAuth({
  appName: "emerge-box",
});

export { handlers, auth, signIn, signOut, authConfig };
