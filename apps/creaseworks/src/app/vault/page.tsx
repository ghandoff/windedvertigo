import type { Metadata } from "next";
import { getSession } from "@/lib/auth-helpers";
import { resolveVaultTier, getVaultActivities } from "@/lib/queries/vault";
import VaultGrid from "@/components/vault/VaultGrid";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "activity vault",
  description:
    "Browse the vertigo vault — facilitation activities for play-based learning.",
};

export default async function VaultCatalogPage() {
  const session = await getSession();

  const tier = await resolveVaultTier(
    session?.orgId ?? null,
    session?.userId ?? null,
    session?.isInternal ?? false,
  );

  const activities = await getVaultActivities(tier);

  return (
    <main className="min-h-screen px-6 py-16 max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2">
          activity vault
        </h1>
        <p className="text-sm text-cadet/60 max-w-xl">
          Facilitation activities for play-based learning. Browse the full
          catalog — unlock explorer and practitioner packs for deeper content,
          facilitator notes, and video walkthroughs.
        </p>
      </div>

      <VaultGrid activities={activities} viewerTier={tier} />
    </main>
  );
}
