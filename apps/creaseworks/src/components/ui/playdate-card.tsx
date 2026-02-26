import Link from "next/link";
import type { ReactNode } from "react";
import CardActionSlot from "./card-action-slot";
import { PlaydateIllustration } from "../playdate-illustration";

export type ProgressTier =
  | "tried_it"
  | "found_something"
  | "folded_unfolded"
  | "found_again";

const TIER_BADGE: Record<ProgressTier, { label: string; className: string }> = {
  tried_it:        { label: "â", className: "bg-cadet/10 text-cadet/40" },
  found_something: { label: "â", className: "bg-champagne/60 text-cadet/50" },
  folded_unfolded:  { label: "ââ", className: "bg-sienna/20 text-sienna" },
  found_again:     { label: "â", className: "bg-redwood/15 text-redwood" },
};

/* ââ colour accents per arc name ââ */
const ARC_COLOURS: Record<string, string> = {
  explore:   "bg-sienna/10 text-sienna/80",
  express:   "bg-redwood/10 text-redwood/70",
  construct: "bg-cadet/8 text-cadet/70",
  move:      "bg-champagne text-cadet/70",
  connect:   "bg-sienna/15 text-sienna",
  observe:   "bg-cadet/10 text-cadet/60",
};

/** Subtle left-border hue derived from the primaryFunction string */
function functionAccentColor(fn: string | null): string {
  if (!fn) return "rgba(39, 50, 72, 0.08)";   /* cadet tint */
  const hash = [...fn].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
  const palette = [
    "rgba(203, 120, 88, 0.25)",   /* sienna  */
    "rgba(177, 80, 67, 0.2)",     /* redwood */
    "rgba(39, 50, 72, 0.15)",     /* cadet   */
    "rgba(228, 196, 137, 0.4)",   /* champagne */
    "rgba(203, 120, 88, 0.15)",   /* sienna light */
    "rgba(177, 80, 67, 0.12)",    /* redwood light */
  ];
  return palette[Math.abs(hash) % palette.length];
}

/** Translate friction dial to parent-friendly energy level label */
function getEnergyLabel(
  frictionDial: number | null,
): { emoji: string; label: string } | null {
  if (frictionDial === null) return null;
  if (frictionDial <= 2) return { emoji: "ð¿", label: "calm" };
  if (frictionDial === 3) return { emoji: "ð¤ï¸", label: "moderate" };
  return { emoji: "â¡", label: "active" };
}

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
  /** Optional: age range for the playdate (e.g. "3-5", "5-8", "all ages") */
  ageRange?: string | null;
  /** Optional: user's progress tier on this playdate (playbook pages only) */
  progressTier?: ProgressTier | null;
  /** Optional: number of evidence items captured for this playdate */
  evidenceCount?: number;
  /** Optional: number of times this playdate has been completed */
  runCount?: number;
  /** Override the link href (e.g. for collection context) */
  href?: string;
  /** Optional slot for an action button (e.g. QuickLogButton) rendered in-card */
  action?: ReactNode;
  /** Optional: show the illustration at the top of the card (default: true) */
  showIllustration?: boolean;
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
  ageRange,
  progressTier,
  evidenceCount,
  runCount,
  href,
  action,
  showIllustration = true,
}: PlaydateCardProps) {
  const badge = progressTier ? TIER_BADGE[progressTier] : null;
  const isBeginner = frictionDial !== null && frictionDial <= 2 && startIn120s;

  return (
    <Link
      href={href ?? `/sampler/${slug}`}
      className="relative block rounded-xl border border-cadet/10 bg-white shadow-sm hover:shadow-md hover:border-sienna/40 transition-all overflow-hidden"
      style={{ borderLeftWidth: 3, borderLeftColor: functionAccentColor(primaryFunction) }}
    >
      {/* illustration header */}
      {showIllustration && (
        <div className="mb-4 -mx-6 -mt-6 w-[calc(100%+48px)]">
          <PlaydateIllustration slug={slug} primaryFunction={primaryFunction} contextTags={contextTags} height={120} />
        </div>
      )}

      {/* content area with padding */}
      <div className="p-6">
        {/* progress tier badge (top-right) */}
        {badge && (
          <span
            className={`absolute top-3 right-3 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${badge.className}`}
            title={progressTier?.replace(/_/g, " ") ?? ""}
          >
            {badge.label}
          </span>
        )}

        {/* beginner-friendly badge */}
        {isBeginner && !badge && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-champagne px-2 py-0.5 text-[10px] font-semibold text-sienna">
            great first pick
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
          {ageRange && (
            <span className="inline-block rounded-full bg-cadet/8 px-2.5 py-0.5 text-xs font-medium text-cadet/70">
              ages {ageRange}
            </span>
          )}
          {arcEmphasis.map((arc) => (
            <span
              key={arc}
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs ${ARC_COLOURS[arc.toLowerCase()] ?? "bg-cadet/5 text-cadet/70"}`}
            >
              {arc}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs text-cadet/50">
          {frictionDial !== null && (() => {
            const energy = getEnergyLabel(frictionDial);
            return energy ? (
              <span title={`energy level ${frictionDial}/5`}>
                {energy.emoji} {energy.label}
              </span>
            ) : null;
          })()}
          {startIn120s && <span>ready in 2 min</span>}
          {hasFindAgain && (
            <span className="inline-block rounded-full bg-sienna/10 px-2 py-0.5 text-xs font-medium text-sienna">
              find again
            </span>
          )}
          {!!runCount && runCount > 0 && (
            runCount >= 5 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-sienna/15 px-2 py-0.5 text-xs font-semibold text-sienna">
                ð¥ popular
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-cadet/8 px-2 py-0.5 text-xs font-medium text-cadet/60">
                {runCount} {runCount === 1 ? "try" : "tries"}
              </span>
            )
          )}
          {!!evidenceCount && evidenceCount > 0 && (
            <span className="text-[10px] text-cadet/30">
              {evidenceCount} piece{evidenceCount !== 1 ? "s" : ""} of evidence
            </span>
          )}
        </div>

        {/* optional action slot (e.g. quick-log button) */}
        {action && <CardActionSlot>{action}</CardActionSlot>}
      </div>
    </Link>
  );
}
