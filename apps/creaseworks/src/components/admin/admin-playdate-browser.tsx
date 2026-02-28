"use client";

import { useState } from "react";
import { PlaydateCard } from "@/components/ui/playdate-card";

interface Playdate {
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
}

interface PackMapping {
  id: string;
  slug: string;
  title: string;
  playdate_ids: string[];
}

interface AdminPlaydateBrowserProps {
  playdates: Playdate[];
  packMappings: PackMapping[];
}

export default function AdminPlaydateBrowser({
  playdates,
  packMappings,
}: AdminPlaydateBrowserProps) {
  const [selectedPack, setSelectedPack] = useState<string | null>(null);

  const filtered = selectedPack
    ? playdates.filter((p) => {
        const mapping = packMappings.find((m) => m.id === selectedPack);
        return mapping?.playdate_ids.includes(p.id);
      })
    : playdates;

  // Group filtered playdates by release_channel
  const sampler = filtered.filter((p) => p.release_channel === "sampler");
  const internal = filtered.filter((p) => p.release_channel === "internal-only");
  const campaign = filtered.filter(
    (p) => p.release_channel !== "sampler" && p.release_channel !== "internal-only",
  );

  const selectedPackTitle = selectedPack
    ? packMappings.find((m) => m.id === selectedPack)?.title
    : null;

  return (
    <div>
      {/* filter bar */}
      <div className="mb-8 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedPack(null)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            selectedPack === null
              ? "bg-cadet text-white"
              : "bg-cadet/5 text-cadet/60 hover:bg-cadet/10"
          }`}
        >
          all ({playdates.length})
        </button>
        {packMappings.map((pack) => (
          <button
            key={pack.id}
            onClick={() => setSelectedPack(pack.id === selectedPack ? null : pack.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              selectedPack === pack.id
                ? "bg-sienna text-white"
                : "bg-sienna/5 text-sienna/70 hover:bg-sienna/10"
            }`}
          >
            {pack.title} ({pack.playdate_ids.length})
          </button>
        ))}
      </div>

      {/* selected pack preview banner */}
      {selectedPackTitle && (
        <div className="mb-6 rounded-lg border border-sienna/20 bg-sienna/5 px-4 py-2 text-sm text-sienna">
          previewing <strong>{selectedPackTitle}</strong> — this is what
          entitled users see when they open this pack.
        </div>
      )}

      {/* playdate grid — grouped by channel */}
      {sampler.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-1">
            sampler
            <span className="text-sm font-normal text-cadet/50 ml-2">
              ({sampler.length} playdates — visible to everyone)
            </span>
          </h2>
          <p className="text-xs text-cadet/40 mb-4">
            these are the playdates the public sees at /sampler
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sampler.map((p) => (
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
                tinkeringTier={p.tinkering_tier}
                runCount={p.run_count}
                coverUrl={p.cover_url}
                visibleFields={null}
              />
            ))}
          </div>
        </section>
      )}

      {campaign.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-1">
            campaign
            <span className="text-sm font-normal text-cadet/50 ml-2">
              ({campaign.length} playdates — visible via campaign links only)
            </span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaign.map((p) => (
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
                tinkeringTier={p.tinkering_tier}
                runCount={p.run_count}
                coverUrl={p.cover_url}
                visibleFields={null}
              />
            ))}
          </div>
        </section>
      )}

      {internal.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-1">
            internal-only
            <span className="text-sm font-normal text-cadet/50 ml-2">
              ({internal.length} playdates — pack-gated or hidden)
            </span>
          </h2>
          <p className="text-xs text-cadet/40 mb-4">
            these are only visible to entitled users or internal team
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {internal.map((p) => (
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
                tinkeringTier={p.tinkering_tier}
                runCount={p.run_count}
                coverUrl={p.cover_url}
                visibleFields={null}
              />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-cadet/40 text-sm">
            no playdates match the current filter.
          </p>
        </div>
      )}
    </div>
  );
}
