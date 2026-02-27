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
  tried_it:        { label: "◎", className: "bg-cadet/10 text-cadet/40" },
  found_something: { label: "◉", className: "bg-champagne/60 text-cadet/50" },
  folded_unfolded:  { label: "◉◉", className: "bg-sienna/20 text-sienna" },
  found_again:     { label: "★", className: "bg-redwood/15 text-redwood" },
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
/* ── tinkering tier visual mapping ── */
const TINKERING_TIERS: Record<string, { emoji: string; label: string; className: string }> = {
  guided:      { emoji: "🧩", label: "guided",      className: "bg-cadet/8 text-cadet/60" },
  scaffolded:  { emoji: "🔧", label: "scaffolded",  className: "bg-champagne text-cadet/70" },
  "open-ended":{ emoji: "🎨", label: "open-ended",  className: "bg-sienna/12 text-sienna/80" },
  "free-form": { emoji: "✨", label: "free-form",   className: "bg-redwood/10 text-redwood/70" },
};

function getEnergyLabel(
  frictionDial: number | null,
): { emoji: string; label: string } | null {
  if (frictionDial === null) return null;
  if (frictionDial <= 2) return { emoji: "🌿", label: "calm" };
  if (frictionDial === 3) return { emoji: "🌤️", label: "moderate" };
  return { emoji: "⚡", label: "active" };
}

/** Pack badge info for FOMO upsell on sampler cards */
export interface PackBadgeInfo {
  packSlug: string;
  packTitle: string;
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
  /** Optional: pack info for FOMO badge on sampler cards */
  packInfo?: PackBadgeInfo | null;
  /** Optional: tinkering tier (guided | scaffolded | open-ended | free-form) */
  tinkeringTier?: string | null;
  /** Optional: number of families exploring this playdate */
  family_count?: number;
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
  packInfo,
  tinkeringTier,
  family_count,
}: PlaydateCardProps) {
  const badge = progressTier ? TIER_BADGE[progressTier] : null;
  const isBeginner = frictionDial !== null && frictionDial <= 2 && startIn120s;

  return (
    <Link
      href={href ?? `/sampler/${slug}`}
      className="relative block rounded-xl border border-cadet/10 bg-white shadow-sm hover:shadow-md hover:border-sienna/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
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
          {tinkeringTier && TINKERING_TIERS[tinkeringTier] && (
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TINKERING_TIERS[tinkeringTier].className}`}
              title={`tinkering: ${tinkeringTier}`}
            >
              {TINKERING_TIERS[tinkeringTier].emoji} {TINKERING_TIERS[tinkeringTier].label}
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

        {/* pack badge — shows when playdate is in an unpurchased pack */}
        {packInfo && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sienna/8 px-2.5 py-0.5 text-[10px] font-medium text-sienna/70 mb-2">
            🔒 {packInfo.packTitle}
          </span>
        )}

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
                🔥 popular
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-cadet/8 px-2 py-0.5 text-xs font-medium text-cadet/60">
                {runCount} {runCount === 1 ? "try" : "tries"}
              </span>
            )
          )}
          {!!evidenceCount && evidenceCount > 0 && (
            <span className="text-[10px] text-cadet/40">
              {evidenceCount} piece{evidenceCount !== 1 ? "s" : ""} of evidence
            </span>
          )}
          {!!family_count && family_count > 0 && (
            <span className="text-[10px] text-cadet/40">
              {family_count} {family_count === 1 ? "family" : "families"} exploring
            </span>
          )}
        </div>

        {/* optional action slot (e.g. quick-log button) */}
        {action && <CardActionSlot>{action}</CardActionSlot>}
      </div>
    </Link>
  );
}
