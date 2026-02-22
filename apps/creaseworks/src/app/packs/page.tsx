import Link from "next/link";
import PackCard from "@/components/ui/pack-card";
import { getVisiblePacks } from "@/lib/queries/packs";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function PacksCataloguePage() {
  const packs = await getVisiblePacks();

  return (
    <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        packs
      </h1>
      <p className="text-cadet/60 mb-8">
        each pack unlocks the full pattern script, materials notes, and a
        guided find-again prompt for every pattern inside.
      </p>

      {packs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-cadet/40 text-sm">
            no packs available yet. check back soon.
          </p>
          <Link
            href="/sampler"
            className="mt-4 inline-block text-sm text-redwood hover:text-sienna transition-colors"
          >
            browse the sampler &rarr;
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {packs.map((pack: any) => (
            <PackCard key={pack.id} pack={pack} />
          ))}
        </div>
      )}
    </main>
  );
}
