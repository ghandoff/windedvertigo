import { fetchVaultActivities } from "@/lib/notion";
import VaultGallery from "@/components/vault-gallery";
import Link from "next/link";

export const revalidate = 3600; // ISR — revalidate every hour

export default async function VaultPage() {
  const activities = await fetchVaultActivities();

  return (
    <>
      <a href="#vault-gallery" className="skip-link">
        Skip to activities
      </a>

      <main className="min-h-screen px-6 pt-12 pb-20 max-w-6xl mx-auto">
        {/* header */}
        <header className="mb-10">
          <Link
            href="/reservoir"
            className="text-xs uppercase tracking-wider opacity-30 hover:opacity-60 transition-opacity mb-6 inline-block"
          >
            &larr; reservoir
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            vertigo.vault
          </h1>
          <p className="opacity-50 max-w-lg text-sm leading-relaxed">
            a curated collection of group activities, energizers, and reflective
            exercises. filter by type or duration, then click any card to see the
            full instructions.
          </p>
        </header>

        {/* CTA — expanded vault teaser */}
        <div className="mb-8 rounded-xl border border-white/10 px-6 py-4 flex items-center justify-between gap-4 flex-wrap"
             style={{ backgroundColor: "rgba(107,142,107,0.08)" }}>
          <p className="text-sm opacity-70">
            <span className="font-medium opacity-100">new activities are being added to the expanded vault.</span>{" "}
            get access to facilitator notes, video walkthroughs, and more activities.
          </p>
          <a
            href="https://windedvertigo.com/reservoir/creaseworks/vault"
            className="shrink-0 rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors"
            style={{ backgroundColor: "rgba(107,142,107,0.25)", color: "rgba(255,255,255,0.85)" }}
          >
            explore the full library &rarr;
          </a>
        </div>

        <VaultGallery activities={activities} />

        {/* footer */}
        <footer className="mt-20 pt-8 border-t border-white/10 text-center">
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
