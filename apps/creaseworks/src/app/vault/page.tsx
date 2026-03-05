import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth-helpers";
import { resolveVaultTier, getVaultActivities, type VaultAccessTier } from "@/lib/queries/vault";
import { VaultActivityCard } from "@/components/ui/vault-activity-card";
import type { VaultActivity } from "@/components/ui/vault-activity-card";

export const metadata: Metadata = {
  title: "activity vault",
  description:
    "browse group activities, energizers, and reflective exercises. filter by type or duration, then unlock step-by-step guides.",
};

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function VaultCatalogPage() {
  const session = await getSession();

  const accessTier = await resolveVaultTier(
    session?.orgId ?? null,
    session?.userId ?? null,
    session?.isInternal ?? false,
  );

  const activities = await getVaultActivities(accessTier);
  const isEntitled = accessTier !== "teaser";

  return (
    <main className="min-h-screen px-6 pt-16 pb-24 sm:pb-16 max-w-5xl mx-auto">
      <header className="mb-12">
        <Link href="/" className="text-sm text-cadet/50 hover:text-cadet mb-4 inline-block">
          &larr; creaseworks
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          activity vault
        </h1>
        <p className="text-cadet/60 max-w-lg">
          {isEntitled
            ? `browse ${activities.length} group activities, energizers, and reflective exercises. click any card for the full guide.`
            : `browse ${activities.length} free activities from our PRME collection. unlock 50+ more with an explorer or practitioner pack.`}
        </p>
      </header>

      {/* tier-aware banner */}
      <TierBanner tier={accessTier} activityCount={activities.length} />

      {activities.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-cadet/50 text-sm">
            new activities are on the way — check back soon!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 wv-stagger">
          {activities.map((a: VaultActivity) => (
            <VaultActivityCard
              key={a.id}
              activity={a}
              isEntitled={isEntitled}
            />
          ))}
        </div>
      )}
    </main>
  );
}

/* ── helper components ──────────────────────────────────────────── */

function TierBanner({
  tier,
  activityCount,
}: {
  tier: VaultAccessTier;
  activityCount: number;
}) {
  if (tier === "teaser") {
    return (
      <div
        className="mb-8 rounded-xl border px-6 py-4 flex items-center justify-between gap-4 flex-wrap"
        style={{
          borderColor: "rgba(107,142,107,0.3)",
          backgroundColor: "rgba(107,142,107,0.06)",
        }}
      >
        <p className="text-sm text-cadet/60">
          <span className="font-medium text-cadet">
            unlock the full vault.
          </span>{" "}
          get access to step-by-step guides, facilitator notes, video
          walkthroughs, and more activities.
        </p>
        <Link
          href="/packs"
          className="shrink-0 rounded-lg bg-redwood px-4 py-2 text-xs font-medium text-white hover:bg-sienna transition-colors"
        >
          explore packs &rarr;
        </Link>
      </div>
    );
  }

  if (tier === "entitled") {
    return (
      <div
        className="mb-8 rounded-xl border px-6 py-4 flex items-center justify-between gap-4 flex-wrap"
        style={{
          borderColor: "rgba(203,120,88,0.3)",
          backgroundColor: "rgba(203,120,88,0.06)",
        }}
      >
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-medium text-cadet">explorer pack</p>
            <p className="text-xs text-cadet/50">
              you have access to {activityCount} activities with full guides and materials.
            </p>
          </div>
        </div>
        <Link
          href="/packs"
          className="shrink-0 rounded-lg bg-redwood px-4 py-2 text-xs font-medium text-white hover:bg-sienna transition-colors"
        >
          upgrade to practitioner &rarr;
        </Link>
      </div>
    );
  }

  if (tier === "practitioner") {
    return (
      <div
        className="mb-8 rounded-xl border px-6 py-4 flex items-center gap-3"
        style={{
          borderColor: "rgba(155,67,67,0.2)",
          backgroundColor: "rgba(155,67,67,0.04)",
        }}
      >
        <div>
          <p className="text-sm font-medium text-cadet">practitioner pack</p>
          <p className="text-xs text-cadet/50">
            full access to all {activityCount} activities including facilitator
            notes and video walkthroughs.
          </p>
        </div>
      </div>
    );
  }

  // internal
  return (
    <div className="mb-8 rounded-xl border border-cadet/10 px-6 py-4 flex items-center gap-3 bg-white">
      <span className="inline-block w-2 h-2 rounded-full bg-sienna" />
      <p className="text-xs text-cadet/50">
        internal view — all {activityCount} activities visible with full metadata
      </p>
    </div>
  );
}
