import { fetchVaultActivities } from "@/lib/notion";
import VaultGallery from "@/components/vault-gallery";
import Link from "next/link";

export const revalidate = 3600; // ISR — revalidate every hour

export default async function VaultPage() {
  const activities = await fetchVaultActivities();

  return (
    <main className="min-h-screen px-6 pt-12 pb-20 max-w-6xl mx-auto">
      {/* header */}
      <header className="mb-10">
        <Link
          href="https://windedvertigo.com"
          className="text-xs uppercase tracking-wider opacity-30 hover:opacity-60 transition-opacity mb-6 inline-block"
        >
          &larr; windedvertigo
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          vertigo vault
        </h1>
        <p className="opacity-50 max-w-lg text-sm leading-relaxed">
          a curated collection of group activities, energizers, and reflective
          exercises. filter by type or duration, then click any card to see the
          full instructions.
        </p>
      </header>

      <VaultGallery activities={activities} />

      {/* footer */}
      <footer className="mt-20 pt-8 border-t border-white/8 text-center">
        <p className="text-xs opacity-25">
          built by{" "}
          <a
            href="https://windedvertigo.com"
            className="underline hover:opacity-60"
          >
            windedvertigo
          </a>
        </p>
      </footer>
    </main>
  );
}
