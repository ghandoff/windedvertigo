/**
 * Re-export shared Auth.js v5 config from lib/shared/auth.
 * All auth logic (Google SSO, domain gating, cookie config) lives in the shared package.
 */
export { handlers, auth, signIn, signOut } from "@/lib/shared/auth";
