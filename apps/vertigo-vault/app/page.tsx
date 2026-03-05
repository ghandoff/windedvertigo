import Link from "next/link";
import { getSession } from "@/lib/auth-helpers";
import { resolveVaultTier, getVaultActivities } from "@/lib/queries/vault";
import VaultActivityGrid from "@/components/vault-activity-grid";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
          <Link
            href="https://windedvertigo.com"
            className="text-xs uppercase tracking-wider opacity-30 hover:opacity-60 transition-opacity mb-6 inline-block"
          >
            &larr; winded.vertigo
          </Link>
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

            {/* auth actions */}
            <div className="flex items-center gap-3">
              {session ? (
                <span
                  className="text-xs"
                  style={{ color: "var(--vault-text-muted)" }}
                >
                  signed in as {session.email}
                </span>
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

        {/* upsell CTA — show only to non-entitled users */}
        {!isEntitled && (
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
        )}

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
