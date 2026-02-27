/**
 * /scavenger — aggregation page for all campaign-tagged playdates.
 *
 * A standalone access point that collects every playdate tagged with
 * a campaign_tag, groups them by campaign, and presents them in a
 * scavenger-hunt style. Public — no auth required.
 *
 * Each campaign section links through to the individual campaign
 * landing page for deeper context.
 */

import type { Metadata } from "next";
import { getAllCampaignPlaydates } from "@/lib/queries/playdates";
import { PlaydateCard } from "@/components/ui/playdate-card";
import Link from "next/link";

export const metadata: Metadata = {
  title: "scavenger hunts — creaseworks",
  description:
    "discover themed playdate trails — each scavenger hunt is a curated set of hands-on activities linked by a common material or idea.",
};

export const dynamic = "force-dynamic";
export const revalidate = 3600;

interface CampaignPlaydate {
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
  campaign_tags: string[];
  has_find_again?: boolean;
  run_count: number;
  tinkering_tier: string | null;
}

// Campaign display metadata — extend as campaigns are added.
const CAMPAIGN_META: Record<
  string,
  { title: string; tagline: string; emoji: string }
> = {
  acetate: {
    title: "color acetate adventures",
    tagline:
      "layer, project, and overlap color acetate sheets to discover what happens when light meets color.",
    emoji: "🔮",
  },
};

function campaignMeta(slug: string) {
  return (
    CAMPAIGN_META[slug] ?? {
      title: slug.replace(/-/g, " "),
      tagline: `a collection of playdates from the ${slug.replace(/-/g, " ")} trail.`,
      emoji: "🗺️",
    }
  );
}

export default async function ScavengerPage() {
  const allPlaydates = await getAllCampaignPlaydates();

  // Group playdates by campaign tag (a playdate can appear in multiple campaigns)
  const campaignMap = new Map<string, typeof allPlaydates>();
  for (const p of allPlaydates) {
    const tags: string[] = p.campaign_tags ?? [];
    for (const tag of tags) {
      if (!campaignMap.has(tag)) campaignMap.set(tag, []);
      campaignMap.get(tag)!.push(p);
    }
  }

  const campaigns = Array.from(campaignMap.entries()).sort(
    ([a], [b]) => a.localeCompare(b),
  );

  return (
    <main className="min-h-screen px-6 pt-16 pb-24 sm:pb-16 max-w-5xl mx-auto">
      <header className="mb-12">
        <Link
          href="/"
          className="text-sm text-cadet/50 hover:text-cadet mb-4 inline-block"
        >
          &larr; creaseworks
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          scavenger hunts
        </h1>
        <p className="text-cadet/60 max-w-lg">
          themed playdate trails — each hunt is a set of activities linked by a
          common material or idea. pick a trail and start exploring.
        </p>
      </header>

      {campaigns.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-cadet/40 mb-4">
            no scavenger hunts are live yet — check back soon.
          </p>
          <Link
            href="/sampler"
            className="text-sm text-sienna/70 hover:text-sienna transition-colors"
          >
            browse the sampler instead &rarr;
          </Link>
        </div>
      ) : (
        <div className="space-y-16">
          {campaigns.map(([tag, playdates]) => {
            const meta = campaignMeta(tag);
            return (
              <section key={tag}>
                {/* campaign header */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{meta.emoji}</span>
                    <h2 className="text-xl font-semibold tracking-tight text-cadet">
                      {meta.title}
                    </h2>
                    <span className="text-xs text-cadet/30 ml-auto">
                      {playdates.length}{" "}
                      {playdates.length === 1 ? "playdate" : "playdates"}
                    </span>
                  </div>
                  <p className="text-sm text-cadet/50 max-w-lg">
                    {meta.tagline}
                  </p>
                  <Link
                    href={`/campaign/${tag}`}
                    className="text-xs text-sienna/60 hover:text-sienna transition-colors mt-1 inline-block"
                  >
                    view full trail &rarr;
                  </Link>
                </div>

                {/* playdate grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {playdates.map((p: CampaignPlaydate) => (
                    <PlaydateCard
                      key={`${tag}-${p.id}`}
                      slug={p.slug}
                      title={p.title}
                      headline={p.headline}
                      primaryFunction={p.primary_function}
                      arcEmphasis={p.arc_emphasis ?? []}
                      contextTags={p.context_tags ?? []}
                      frictionDial={p.friction_dial}
                      startIn120s={p.start_in_120s}
                      hasFindAgain={p.has_find_again}
                      tinkeringTier={p.tinkering_tier}
                      runCount={p.run_count}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* CTA */}
      <div className="mt-16 text-center">
        <p className="text-cadet/50 text-sm mb-3">
          want to explore beyond the trails?
        </p>
        <Link
          href="/sampler"
          className="inline-block px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: "var(--wv-redwood)",
            color: "var(--wv-white)",
          }}
        >
          browse all playdates
        </Link>
      </div>
    </main>
  );
}
