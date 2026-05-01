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
 * Creaseworks auth — uses the shared harbour auth package with
 * app-specific hooks for org auto-join, invite processing, admin
 * bootstrapping, and UI tier enrichment.
 */
const { handlers, auth, signIn, signOut, authConfig } = createHarbourAuth({
  appName: "creaseworks",

  async onFirstSignIn(userId: string, email: string) {
    // Auto-join org based on verified email domains
    await autoJoinOrg(userId, email);

    // Process any pending invites — grants user-level pack entitlements
    await processInvitesOnSignIn(userId, email);

    // Bootstrap initial admin if configured
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

  refreshInterval: 5 * 60 * 1000, // 5 minutes
});

export { handlers, auth, signIn, signOut, authConfig };
