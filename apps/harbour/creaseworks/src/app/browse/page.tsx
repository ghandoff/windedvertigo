import type { Metadata } from "next";
import Link from "next/link";
import { getAllReadyPlaydates, getPublishedPlaydates, batchGetMaterialsForPlaydates } from "@/lib/queries/playdates";
import { getSession } from "@/lib/auth-helpers";
import { batchGetPackInfoForPlaydates } from "@/lib/queries/packs";
import PlaydateGrid from "@/components/playdate-grid";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "browse playdates",
  description:
    "explore the full catalogue of creative playdates — filter by function, energy level, and more.",
  openGraph: {
    title: "browse playdates",
    description:
      "explore the full catalogue of creative playdates — filter by function, energy level, and more.",
  },
};

interface TeaserPlaydate {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  release_channel: string | null;
  status: string;
  primary_function: string | null;
  arc_emphasis: string[];
  context_tags: string[];
  friction_dial: number | null;
  start_in_120s: boolean;
  has_find_again?: boolean;
  run_count: number;
  tinkering_tier: string | null;
  cover_url?: string | null;
  gallery_visible_fields?: string[] | null;
}

export default async function BrowsePage() {
  const session = await getSession();
  const isInternal = session?.isInternal ?? false;

  const playdates: TeaserPlaydate[] = isInternal
    ? await getAllReadyPlaydates()
    : await getPublishedPlaydates();

  const playdateIds = playdates.map((p) => p.id);

  const [packInfoMap, materialsMap] = await Promise.all([
    batchGetPackInfoForPlaydates(playdateIds),
    batchGetMaterialsForPlaydates(playdateIds),
  ]);

  // Serialize Maps for the client component
  const packInfoEntries: [string, { packSlug: string; packTitle: string }][] =
    Array.from(packInfoMap.entries());
  const materialsEntries = Array.from(materialsMap.entries());

  return (
    <main className="min-h-screen px-6 pt-16 pb-24 sm:pb-16 max-w-5xl mx-auto">
      <header className="mb-8">
        <Link
          href="/sampler"
          className="text-sm text-cadet/50 hover:text-cadet mb-4 inline-block"
        >
          &larr; sampler
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-semibold tracking-tight font-serif">
            all playdates
          </h1>
          {isInternal && (
            <span className="text-2xs font-semibold tracking-wide px-2 py-0.5 rounded-full bg-cream/20 text-champagne">
              collective view
            </span>
          )}
        </div>
        <p className="text-cadet/60 max-w-lg">
          every activity in the creaseworks catalogue.
          filter by what matters, find something new.
        </p>
      </header>

      <PlaydateGrid
        playdates={playdates}
        packInfoEntries={packInfoEntries}
        materialsEntries={materialsEntries}
        showChannelBadge={isInternal}
      />
    </main>
  );
}
