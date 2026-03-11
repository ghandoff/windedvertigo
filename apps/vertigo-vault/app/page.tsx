import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth-helpers";
import { resolveVaultTier, getVaultActivities, type VaultAccessTier } from "@/lib/queries/vault";
import VaultActivityGrid from "@/components/vault-activity-grid";
import UserMenu from "@/components/ui/user-menu";

export const dynamic = "force-dynamic";

const BASE_URL = "https://windedvertigo.com/harbour/vertigo-vault";

export const metadata: Metadata = {
  title: "vertigo.vault — group activities, energizers & reflective exercises",
  description:
    "browse a curated collection of group activities, energizers, and reflective exercises. filter by type or duration, then unlock step-by-step guides.",
  alternates: { canonical: BASE_URL },
  openGraph: {
    type: "website",
    title: "vertigo.vault — group activities, energizers & reflective exercises",
    description:
      "browse a curated collection of group activities, energizers, and reflective exercises. filter by type or duration, then unlock step-by-step guides.",
    url: BASE_URL,
    siteName: "winded.vertigo",
  },
  twitter: {
    card: "summary",
    title: "vertigo.vault — group activities & energizers",
    description:
      "browse a curated collection of group activities, energizers, and reflective exercises.",
  },
};

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
    <>
      <a href="#vault-gallery" className="skip-link">
        Skip to activities
      </a>

      <main className="min-h-screen px-6 pt-12 pb-20 max-w-6xl mx-auto">
        {/* header */}
        <header className="mb-10">
          <a
            href="/harbour"
            className="text-xs tracking-wider opacity-30 hover:opacity-60 transition-opacity mb-6 inline-block"
          >
            &larr; harbour
          </a>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">
                vertigo.vault
              </h1>
              <p
                className="max-w-lg text-sm leading-relaxed"
                style={{ color: "var(--vault-text-muted)" }}
              >
                {isEntitled
                  ? "a curated collection of group activities, energizers, and reflective exercises. filter by type or duration, then click any card to see the full instructions."
                  : `browse ${activities.length} free activities from our PRME collection. unlock 50+ more with an explorer or practitioner pack.`}
              </p>
            </div>

            {/* auth + tier info */}
            <div className="flex items-center gap-3">
              {session ? (
                <UserMenu email={session.email ?? ""} tier={accessTier} />
              ) : (
                <Link
                  href="/login"
                  className="rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors"
                  style={{
                    backgroundColor: "rgba(175,79,65,0.2)",
                    color: "rgba(255,255,255,0.85)",
                  }}
                >
                  sign in
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* tier-aware banner */}
        <TierBanner tier={accessTier} activityCount={activities.length} />

        <div id="vault-gallery">
          <VaultActivityGrid activities={activities} isEntitled={isEntitled} />
        </div>

        {/* footer */}
        <footer className="mt-20 pt-8 border-t text-center" style={{ borderColor: "var(--vault-border)" }}>
          <p className="text-xs opacity-25">
            built by{" "}
            <a
              href="https://windedvertigo.com"
              className="underline hover:opacity-60"
            >
              winded.vertigo
            </a>
          </p>
        </footer>
      </main>
    </>
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
  // teaser → upsell to explore packs
  if (tier === "teaser") {
    return (
      <div
        className="mb-8 rounded-xl border px-6 py-4 flex items-center justify-between gap-4 flex-wrap"
        style={{
          borderColor: "var(--vault-border)",
          backgroundColor: "rgba(107,142,107,0.08)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--vault-text-muted)" }}>
          <span className="font-medium" style={{ color: "var(--vault-text)" }}>
            unlock the full vault.
          </span>{" "}
          get access to step-by-step guides, facilitator notes, video walkthroughs,
          and more activities.
        </p>
        <Link
          href="/explorer"
          className="shrink-0 rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors"
          style={{
            backgroundColor: "rgba(107,142,107,0.25)",
            color: "rgba(255,255,255,0.85)",
          }}
        >
          explore packs &rarr;
        </Link>
      </div>
    );
  }

  // entitled → show current pack + upsell to practitioner
  if (tier === "entitled") {
    return (
      <div
        className="mb-8 rounded-xl border px-6 py-4 flex items-center justify-between gap-4 flex-wrap"
        style={{
          borderColor: "rgba(175,79,65,0.2)",
          backgroundColor: "rgba(175,79,65,0.06)",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg leading-none">📖</span>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--vault-text)" }}>
              explorer pack
            </p>
            <p className="text-xs" style={{ color: "var(--vault-text-muted)" }}>
              you have access to {activityCount} activities with full guides and
              materials.
            </p>
          </div>
        </div>
        <Link
          href="/practitioner"
          className="shrink-0 rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors"
          style={{
            backgroundColor: "rgba(175,79,65,0.2)",
            color: "rgba(255,255,255,0.85)",
          }}
        >
          upgrade to practitioner &rarr;
        </Link>
      </div>
    );
  }

  // practitioner → show current pack, fully unlocked
  if (tier === "practitioner") {
    return (
      <div
        className="mb-8 rounded-xl border px-6 py-4 flex items-center gap-3"
        style={{
          borderColor: "rgba(155,67,67,0.2)",
          backgroundColor: "rgba(155,67,67,0.06)",
        }}
      >
        <span className="text-lg leading-none">🎓</span>
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--vault-text)" }}>
            practitioner pack
          </p>
          <p className="text-xs" style={{ color: "var(--vault-text-muted)" }}>
            full access to all {activityCount} activities including facilitator
            notes and video walkthroughs.
          </p>
        </div>
      </div>
    );
  }

  // internal → dev indicator
  return (
    <div
      className="mb-8 rounded-xl border px-6 py-4 flex items-center gap-3"
      style={{
        borderColor: "var(--vault-border)",
        backgroundColor: "rgba(255,255,255,0.02)",
      }}
    >
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: "var(--vault-accent)" }}
      />
      <p className="text-xs" style={{ color: "var(--vault-text-muted)" }}>
        internal view — all {activityCount} activities visible with full
        metadata
      </p>
    </div>
  );
}
