import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth-helpers";
import { resolveVaultTier, getVaultActivities } from "@/lib/queries/vault";
import { assertNoLeakedFields } from "@/lib/security/assert-no-leaked-fields";
import VaultActivityGrid from "@/components/vault-activity-grid";

export const metadata: Metadata = {
  title: "vertigo vault",
  description:
    "a curated collection of group activities, energizers, and reflective exercises. browse by type or duration.",
};

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function VaultPage() {
  const session = await getSession();

  const accessTier = await resolveVaultTier(
    session?.orgId ?? null,
    session?.userId ?? null,
    session?.isInternal ?? false,
  );

  const activities = await getVaultActivities(accessTier);

  assertNoLeakedFields(
    activities as Record<string, unknown>[],
    `vault_${accessTier}` as "vault_teaser" | "vault_entitled" | "vault_practitioner" | "vault_internal",
  );

  const isEntitled = accessTier !== "teaser";

  return (
    <main className="min-h-screen px-6 pt-16 pb-24 sm:pb-16 max-w-6xl mx-auto">
      <header className="mb-10">
        <Link
          href="/"
          className="text-sm text-cadet/50 hover:text-cadet mb-4 inline-block"
        >
          &larr; creaseworks
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          vertigo vault
        </h1>
        <p className="text-cadet/60 max-w-lg text-sm leading-relaxed">
          a curated collection of group activities, energizers, and reflective
          exercises. filter by type or duration, then click any card for the full
          guide.
        </p>
      </header>

      {/* upsell CTA for non-entitled users */}
      {!isEntitled && activities.length > 0 && (
        <div
          className="mb-8 rounded-xl border px-6 py-4 flex items-center justify-between gap-4 flex-wrap"
          style={{
            borderColor: "rgba(107, 142, 107, 0.2)",
            backgroundColor: "rgba(107, 142, 107, 0.04)",
          }}
        >
          <p className="text-sm text-cadet/70">
            <span className="font-medium text-cadet/90">
              unlock full activity guides.
            </span>{" "}
            get step-by-step instructions, materials lists, and facilitator
            notes with an explorer or practitioner pack.
          </p>
          <Link
            href="/packs"
            className="shrink-0 rounded-full bg-sienna px-4 py-1.5 text-xs font-medium text-white hover:bg-redwood transition-colors"
          >
            see packs &rarr;
          </Link>
        </div>
      )}

      {/* internal tier indicator */}
      {accessTier === "internal" && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cadet/20 bg-cadet/5 px-3 py-1 text-xs text-cadet/60">
          <span className="inline-block w-2 h-2 rounded-full bg-sienna" />
          internal view — all fields visible
        </div>
      )}

      {activities.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-3xl mb-3" aria-hidden>🎭</p>
          <p className="text-cadet/50 text-sm">
            vault activities are being loaded — check back soon!
          </p>
        </div>
      ) : (
        <VaultActivityGrid
          activities={activities}
          isEntitled={isEntitled}
        />
      )}
    </main>
  );
}
