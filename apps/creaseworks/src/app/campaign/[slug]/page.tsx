/**
 * Campaign landing page — shows playdates tagged with a specific campaign.
 *
 * Used for scavenger hunts, promotional links, and partner activations.
 * E.g. /campaign/acetate shows all playdates tagged with "acetate".
 *
 * No auth required — these are public landing pages.
 */

import type { Metadata } from "next";
import { getCampaignPlaydates } from "@/lib/queries/playdates";
import { getCampaignBySlug } from "@/lib/queries/campaigns";
import { PlaydateCard } from "@/components/ui/playdate-card";
import Link from "next/link";
import { notFound } from "next/navigation";

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
  has_find_again?: boolean;
  run_count: number;
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getCampaignBySlug(slug);
  return {
    title: campaign?.title ?? `${slug} — creaseworks campaign`,
    description: campaign?.description ?? `playdates from the ${slug} campaign.`,
  };
}

export const dynamic = "force-dynamic";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [playdates, campaignMeta] = await Promise.all([
    getCampaignPlaydates(slug),
    getCampaignBySlug(slug),
  ]);

  // If no campaign metadata and no playdates, 404
  if (!campaignMeta && playdates.length === 0) {
    notFound();
  }

  const campaign = campaignMeta ?? {
    title: slug.replace(/-/g, " "),
    description: `playdates from the ${slug} campaign.`,
  };

  return (
    <main className="min-h-screen px-6 py-16 max-w-5xl mx-auto">
      <header className="mb-12">
        <Link href="/sampler" className="text-sm text-cadet/50 hover:text-cadet mb-4 inline-block">
          &larr; all playdates
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          {campaign.title}
        </h1>
        <p className="text-cadet/60 max-w-lg">{campaign.description}</p>
      </header>

      {playdates.length === 0 ? (
        <p className="text-cadet/40 text-center py-20">
          this campaign hasn&apos;t started yet — check back soon.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playdates.map((p: CampaignPlaydate) => (
            <PlaydateCard
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
              runCount={p.run_count}
            />
          ))}
        </div>
      )}

      {/* teaser to explore more */}
      <div className="mt-16 text-center">
        <p className="text-cadet/50 text-sm mb-3">
          want more playdates like these?
        </p>
        <Link
          href="/sampler"
          className="inline-block px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: "var(--wv-redwood)",
            color: "var(--wv-white)",
          }}
        >
          browse the sampler
        </Link>
      </div>
    </main>
  );
}
