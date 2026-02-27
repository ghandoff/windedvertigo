/**
 * Seasonal Banner Component
 *
 * Displays seasonal themed playdates in an appealing card/grid format.
 * Server component that fetches seasonal playdates directly.
 */

import Link from "next/link";
import { getSeasonalPlaydates } from "@/lib/queries/seasonal";
import { getSeasonalTheme } from "@/lib/seasonal";
import { PlaydateCard } from "@/components/ui/playdate-card";

export default async function SeasonalBanner() {
  const theme = getSeasonalTheme();
  const playdates = await getSeasonalPlaydates(6);

  // Don't show the banner if no seasonal playdates are available
  if (playdates.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-cadet/10 pt-8 mt-12">
      {/* ── section header ── */}
      <div className="mb-6">
        <h2 className={`text-lg font-semibold text-cadet mb-1`}>
          {theme.emoji} {theme.label}
        </h2>
        <p className="text-sm text-cadet/60">{theme.description}</p>
      </div>

      {/* ── playdates grid ── */}
      <div className="grid gap-3 sm:grid-cols-2 mb-6">
        {playdates.slice(0, 6).map((playdate) => (
          <PlaydateCard
            key={playdate.id}
            slug={playdate.slug}
            title={playdate.title}
            headline={playdate.headline}
            primaryFunction={playdate.primary_function}
            arcEmphasis={playdate.arc_emphasis ?? []}
            contextTags={playdate.context_tags ?? []}
            frictionDial={playdate.friction_dial}
            startIn120s={playdate.start_in_120s ?? false}
            hasFindAgain={playdate.has_find_again}
            tinkeringTier={playdate.tinkering_tier}
            ageRange={playdate.age_range}
            runCount={playdate.run_count}
            href={`/sampler/${playdate.slug}`}
          />
        ))}
      </div>

      {/* ── see more link if there are additional playdates (future expansion) ── */}
      {playdates.length > 6 && (
        <Link
          href={`/sampler?season=${theme.season}`}
          className="block text-sm text-cadet/60 hover:text-cadet transition-colors"
        >
          see all {theme.label.toLowerCase()} →
        </Link>
      )}
    </div>
  );
}
