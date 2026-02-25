import Link from "next/link";

export type ProgressTier =
  | "tried_it"
  | "found_something"
  | "folded_unfolded"
  | "found_again";

const TIER_BADGE: Record<ProgressTier, { label: string; className: string }> = {
  tried_it:        { label: "◎", className: "bg-cadet/10 text-cadet/40" },
  found_something: { label: "◉", className: "bg-champagne/60 text-cadet/50" },
  folded_unfolded:  { label: "◉◉", className: "bg-sienna/20 text-sienna" },
  found_again:     { label: "★", className: "bg-redwood/15 text-redwood" },
};

interface PlaydateCardProps {
  slug: string;
  title: string;
  headline: string | null;
  primaryFunction: string | null;
  arcEmphasis: string[];
  contextTags: string[];
  frictionDial: number | null;
  startIn120s: boolean;
  hasFindAgain?: boolean;
  /** Optional: user's progress tier on this playdate (playbook pages only) */
  progressTier?: ProgressTier | null;
  /** Optional: number of evidence items captured for this playdate */
  evidenceCount?: number;
  /** Optional: number of times this playdate has been completed */
  runCount?: number;
  /** Override the link href (e.g. for collection context) */
  href?: string;
}

export function PlaydateCard({
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
  runCount,
  href,
}: PlaydateCardProps) {
  const badge = progressTier ? TIER_BADGE[progressTier] : null;

  return (
    <Link
      href={href ?? `/sampler/${slug}`}
      className="relative block rounded-xl border border-cadet/10 bg-white p-6 shadow-sm hover:shadow-md hover:border-sienna/40 transition-all"
    >
      {badge && (
        <span
          className={`absolute top-3 right-3 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${badge.className}`}
          title={progressTier?.replace(/_/g, " ") ?? ""}
        >
          {badge.label}
        </span>
      )}
      <h2 className="text-lg font-semibold text-cadet mb-1">{title}</h2>

      {headline && (
        <p className="text-sm text-cadet/60 mb-3">{headline}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-3">
        {primaryFunction && (
          <span className="inline-block rounded-full bg-champagne px-2.5 py-0.5 text-xs font-medium text-cadet">
            {primaryFunction}
          </span>
        )}
        {arcEmphasis.map((arc) => (
          <span
            key={arc}
            className="inline-block rounded-full bg-cadet/5 px-2.5 py-0.5 text-xs text-cadet/70"
          >
            {arc}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs text-cadet/50">
        {frictionDial !== null && (
          <span title="how much back-and-forth — 1 is chill, 5 is intense">friction: {frictionDial}/5</span>
        )}
        {startIn120s && <span>ready in 2 min</span>}
        {hasFindAgain && (
          <span className="inline-block rounded-full bg-sienna/10 px-2 py-0.5 text-xs font-medium text-sienna">
            find again
          </span>
        )}
        {!!runCount && runCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-cadet/8 px-2 py-0.5 text-xs font-medium text-cadet/60">
            <span aria-hidden>&times;</span>{runCount}
          </span>
        )}
        {!!evidenceCount && evidenceCount > 0 && (
          <span className="text-[10px] text-cadet/30">
            {evidenceCount} piece{evidenceCount !== 1 ? "s" : ""} of evidence
          </span>
        )}
      </div>
    </Link>
  );
}
