import { getTeaserPatterns } from "@/lib/queries/patterns";
import { PatternCard } from "@/components/ui/pattern-card";
import Link from "next/link";

// Force dynamic rendering — the DB connection isn't available at build time.
// On Vercel with ISR this will cache for 1 hour after first request.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function SamplerPage() {
  const patterns = await getTeaserPatterns();

  return (
    <main className="min-h-screen px-6 py-16 max-w-5xl mx-auto">
      <header className="mb-12">
        <Link href="/" className="text-sm text-cadet/50 hover:text-cadet mb-4 inline-block">
          &larr; creaseworks
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          playdate sampler
        </h1>
        <p className="text-cadet/60 max-w-lg">
          free previews of every playdate. each card gives you a taste —
          grab a pack to unlock the full guide, materials list, and
          find again prompts.
        </p>
      </header>

      {patterns.length === 0 ? (
        <p className="text-cadet/40 text-center py-20">
          no playdates here yet. check back soon.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {patterns.map((p: any) => (
            <PatternCard
              key={p.id}
              slug={p.slug}
              title={p.title}
              headline={p.headline}
              primaryFunction={p.primary_function}
              arcEmphasis={p.arc_emphasis ?? []}
              contextTags={p.context_tags ?? []}
              frictionDial={p.friction_dial}
              startIn120s={p.start_in_120s}
              hasFindAgain={p.has_find_again}
            />
          ))}
        </div>
      )}
    </main>
  );
}
