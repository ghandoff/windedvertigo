import { PlaydateCard, type ProgressTier } from '@/components/ui/playdate-card';

/**
 * Start Here Card
 *
 * Wraps a PlaydateCard with a "start here" overlay badge.
 * Used on the sampler page to highlight a recommended first playdate.
 */

interface StartHereCardProps {
  slug: string;
  title: string;
  headline: string | null;
  primaryFunction: string | null;
  arcEmphasis: string[];
  contextTags: string[];
  frictionDial: number | null;
  startIn120s: boolean;
  hasFindAgain?: boolean;
  progressTier?: ProgressTier | null;
  evidenceCount?: number;
  tinkeringTier?: string | null;
  runCount?: number;
  href?: string;
  coverUrl?: string | null;
  visibleFields?: string[] | null;
}

export default function StartHereCard({
  slug,
  title,
  headline,
  primaryFunction,
  arcEmphasis,
  contextTags,
  frictionDial,
  startIn120s,
  hasFindAgain,
  progressTier,
  evidenceCount,
  tinkeringTier,
  runCount,
  href,
  coverUrl,
  visibleFields,
}: StartHereCardProps) {
  return (
    <div className="relative mb-4 sm:mb-6">
      {/* "start here" badge positioned above the card */}
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-champagne px-3 py-1 text-xs font-semibold text-sienna">
          ✨ start here
        </span>
      </div>

      <PlaydateCard
        slug={slug}
        title={title}
        headline={headline}
        primaryFunction={primaryFunction}
        arcEmphasis={arcEmphasis}
        contextTags={contextTags}
        frictionDial={frictionDial}
        startIn120s={startIn120s}
        hasFindAgain={hasFindAgain}
        progressTier={progressTier}
        evidenceCount={evidenceCount}
        tinkeringTier={tinkeringTier}
        runCount={runCount}
        href={href}
        coverUrl={coverUrl}
        visibleFields={visibleFields}
      />
    </div>
  );
}
