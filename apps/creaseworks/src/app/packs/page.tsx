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
        kits
      </h1>
      <p className="text-cadet/60 mb-8">
        each kit is a bundle of play ideas. you get the full step-by-step
        guide, materials list, and a &ldquo;spot it again&rdquo; prompt for
        every idea inside. buy once, keep forever.
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
            browse free ideas &rarr;
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
