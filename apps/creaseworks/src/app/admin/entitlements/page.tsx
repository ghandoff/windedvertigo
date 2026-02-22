/**
 * Admin page: grant and manage entitlements.
 *
 * Stub purchase flow — admin selects org + pack, grants entitlement.
 * Will be replaced with Stripe integration post-MVP.
 */

import { requireAdmin } from "@/lib/auth-helpers";
import { getAllOrganisations } from "@/lib/queries/organisations";
import { getAllReadyPacks } from "@/lib/queries/packs";
import { listAllEntitlements } from "@/lib/queries/entitlements";
import EntitlementGrantForm from "./grant-form";
import EntitlementTable from "./entitlement-table";

export const dynamic = "force-dynamic";

export default async function AdminEntitlementsPage() {
  await requireAdmin();

  const [orgs, packs, entitlements] = await Promise.all([
    getAllOrganisations(),
    getAllReadyPacks(),
    listAllEntitlements(),
  ]);

  return (
    <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold tracking-tight mb-8">
        manage entitlements
      </h1>

      {/* grant form */}
      <section className="rounded-xl border border-cadet/10 bg-champagne/30 p-6 mb-10">
        <h2 className="text-sm font-semibold text-cadet/80 mb-4">
          grant entitlement
        </h2>
        <EntitlementGrantForm orgs={orgs} packs={packs} />
      </section>

      {/* existing entitlements */}
      <section>
        <h2 className="text-sm font-semibold text-cadet/80 mb-4">
          current entitlements
        </h2>

        <EntitlementTable entitlements={entitlements} />
      </section>
    </main>
  );
}
