import { createHarbourAuth } from "@windedvertigo/auth";
import type { EnrichTokenResult } from "@windedvertigo/auth";
import {
  isAdmin,
  addAdmin,
} from "@/lib/queries/users";
import {
  autoJoinOrg,
  getOrgMembership,
} from "@/lib/queries/organisations";
import { processInvitesOnSignIn } from "@/lib/queries/invites";
import { getUserTier } from "@/lib/queries/accessibility";

/**
 * Vertigo-vault auth — uses the shared harbour auth package with
 * the same hooks as creaseworks (shared DB) but a shorter refresh
 * interval (60s) so purchases propagate quickly.
 */
const { handlers, auth, signIn, signOut, authConfig } = createHarbourAuth({
  appName: "vertigo-vault",

  async onFirstSignIn(userId: string, email: string) {
    await autoJoinOrg(userId, email);
    await processInvitesOnSignIn(userId, email);

    const adm = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase().trim();
    if (adm && email.toLowerCase().trim() === adm) {
      if (!(await isAdmin(userId))) {
        await addAdmin(userId);
        console.log("bootstrapped initial admin:", email);
      }
    }
  },

  async enrichToken(userId: string): Promise<EnrichTokenResult> {
    const m = await getOrgMembership(userId);
    return {
      orgId: m?.org_id ?? null,
      orgName: m?.org_name ?? null,
      orgRole: m?.role ?? null,
      isAdmin: await isAdmin(userId),
      uiTier: await getUserTier(userId),
    };
  },

  refreshInterval: 60 * 1000, // 60 seconds — short for purchase propagation
});

export { handlers, auth, signIn, signOut, authConfig };
