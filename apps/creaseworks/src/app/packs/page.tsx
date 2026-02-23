import Link from "next/link";
import PackCard from "@/components/ui/pack-card";
import { getVisiblePacks, getAllPacks } from "@/lib/queries/packs";
import { getSession } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export default async function PacksCataloguePage() {
  const session = await getSession();
  const isCollective = session?.isInternal ?? false;

  // Collective sees all packs (including non-visible and drafts)
  const packs = isCollective ? await getAllPacks() : await getVisiblePacks();

  return (
    <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-3xl font-semibold tracking-tight">packs</h1>
        {isCollective && (
          <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-champagne/20 text-champagne">
            collective view
          </span>
        )}
      </div>
      <p className="text-cadet/60 mb-8">
        each pack is a bundle of playdates. you get the full step-by-step
        guide, materials list, and a find again prompt for every playdate
        inside. buy once, keep forever.
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
            browse free playdates &rarr;
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {packs.map((pack: any) => (
            <div key={pack.id} className="relative">
              {isCollective && pack.visible === false && (
                <span className="absolute top-3 right-3 z-10 text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-cadet/40 text-white/70">
                  hidden
                </span>
              )}
              {isCollective && pack.status !== "ready" && (
                <span className="absolute top-3 left-3 z-10 text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-amber-600/80 text-white">
                  draft
                </span>
              )}
              <PackCard pack={pack} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
