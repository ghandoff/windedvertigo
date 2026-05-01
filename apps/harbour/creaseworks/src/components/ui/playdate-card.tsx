import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import CardActionSlot from "./card-action-slot";
import { PlaydateIllustration } from "../playdate-illustration";

export interface PlaydateMaterial {
  id: string;
  title: string;
  form_primary: string | null;
  functions: string[] | null;
  emoji: string | null;
  icon: string | null;
}

export type ProgressTier =
  | "tried_it"
  | "found_something"
  | "folded_unfolded"
  | "found_again";

const TIER_BADGE: Record<ProgressTier, { label: string; className: string }> = {
  tried_it:        { label: "◎", className: "bg-cadet/10 text-cadet/40" },
  found_something: { label: "◉", className: "bg-cream/60 text-cadet/50" },
  folded_unfolded:  { label: "◉◉", className: "bg-sienna/20 text-sienna" },
  found_again:     { label: "★", className: "bg-redwood/15 text-redwood" },
};

/* ── colour accents per arc name ── */
const ARC_COLOURS: Record<string, string> = {
  explore:   "bg-sienna/10 text-sienna/80",
  express:   "bg-redwood/10 text-redwood/70",
  construct: "bg-cadet/8 text-cadet/70",
  move:      "bg-cream text-cadet/70",
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
const TINKERING_TIERS: Record<string, { label: string; className: string }> = {
  guided:      { label: "guided",      className: "bg-cadet/8 text-cadet/60" },
  scaffolded:  { label: "scaffolded",  className: "bg-cream text-cadet/70" },
  "open-ended":{ label: "open-ended",  className: "bg-sienna/12 text-sienna/80" },
  "free-form": { label: "free-form",   className: "bg-redwood/10 text-redwood/70" },
};

function getEnergyLabel(
  frictionDial: number | null,
): { label: string } | null {
  if (frictionDial === null) return null;
  if (frictionDial <= 2) return { label: "calm" };
  if (frictionDial === 3) return { label: "moderate" };
  return { label: "active" };
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
  /** Optional: cover image URL from R2 (overrides PlaydateIllustration when present) */
  coverUrl?: string | null;
  /** Optional: Notion-controlled list of fields to show on card.
   *  When null/empty, all fields render (backward compatible). */
  visibleFields?: string[] | null;
  /** Optional: materials linked to this playdate (for icon row + function pills) */
  materials?: PlaydateMaterial[] | null;
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
  coverUrl,
  visibleFields,
  materials,
}: PlaydateCardProps) {
  const badge = progressTier ? TIER_BADGE[progressTier] : null;
  const isBeginner = frictionDial !== null && frictionDial <= 2 && startIn120s;

  /** When visibleFields is null/empty, show everything (backward compat). */
  const show = (field: string) =>
    !visibleFields || visibleFields.length === 0 || visibleFields.includes(field);

  return (
    <Link
      href={href ?? `/sampler/${slug}`}
      className="relative flex flex-col h-full rounded-xl shadow-sm hover:shadow-md hover:border-sienna/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
      style={{ background: "var(--wv-cream)", border: "1.5px solid rgba(39, 50, 72, 0.08)", borderLeftWidth: 3, borderLeftColor: functionAccentColor(primaryFunction) }}
    >
      {/* cover / illustration header */}
      {showIllustration && coverUrl ? (
        <div className="relative w-full h-[120px] overflow-hidden">
          <Image
            src={coverUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      ) : showIllustration ? (
        <div className="mb-4 -mx-6 -mt-6 w-[calc(100%+48px)]">
          <PlaydateIllustration slug={slug} primaryFunction={primaryFunction} contextTags={contextTags} height={120} />
        </div>
      ) : null}

      {/* badges — positioned over cover image */}
      {badge && (
        <span
          className={`absolute top-3 right-3 z-10 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-2xs font-semibold leading-none ${badge.className}`}
          title={progressTier?.replace(/_/g, " ") ?? ""}
        >
          {badge.label}
        </span>
      )}
      {isBeginner && !badge && (
        <span className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-sm px-2 py-0.5 text-2xs font-semibold text-sienna shadow-sm">
          great first pick
        </span>
      )}

      {/* content area with padding */}
      <div className="flex-1 flex flex-col p-4">

        <h2 className="text-base font-semibold text-cadet leading-snug mb-1">{title}</h2>

        {show("headline") && headline && (
          <p className="text-xs text-cadet/60 mb-2 line-clamp-2">{headline}</p>
        )}

        {/* material icons row — small visual "what do I need?" */}
        {show("materials") && materials && materials.length > 0 && (
          <div className="flex items-center gap-1 mb-2.5 flex-wrap">
            {materials.slice(0, 5).map((mat) => {
              const iconPath = mat.icon
                ? `/harbour/creaseworks/icons/materials/${mat.icon}.png`
                : null;
              return (
                <span
                  key={mat.id}
                  className="inline-flex items-center justify-center rounded-md"
                  style={{
                    width: 28,
                    height: 28,
                    backgroundColor: "rgba(39, 50, 72, 0.04)",
                  }}
                  title={mat.title}
                >
                  {iconPath ? (
                    <Image src={iconPath} alt={mat.title} width={20} height={20} className="object-contain" />
                  ) : (
                    <span className="text-sm leading-none">{mat.emoji ?? "✨"}</span>
                  )}
                </span>
              );
            })}
            {materials.length > 5 && (
              <span className="text-2xs text-cadet/40 ml-1">
                +{materials.length - 5}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1 mb-2">
          {show("primaryFunction") && primaryFunction && (
            <span className="inline-block rounded-full bg-cream px-2 py-px text-2xs font-medium text-cadet">
              {primaryFunction}
            </span>
          )}
          {show("ageRange") && ageRange && (
            <span className="inline-block rounded-full bg-cadet/8 px-2 py-px text-2xs font-medium text-cadet/70">
              ages {ageRange}
            </span>
          )}
          {show("tinkeringTier") && tinkeringTier && TINKERING_TIERS[tinkeringTier] && (
            <span
              className={`inline-block rounded-full px-2 py-px text-2xs font-medium ${TINKERING_TIERS[tinkeringTier].className}`}
              title={`tinkering: ${tinkeringTier}`}
            >
              {TINKERING_TIERS[tinkeringTier].label}
            </span>
          )}
          {show("arcEmphasis") && arcEmphasis.map((arc) => (
            <span
              key={arc}
              className={`inline-block rounded-full px-2 py-px text-2xs ${ARC_COLOURS[arc.toLowerCase()] ?? "bg-cadet/5 text-cadet/70"}`}
            >
              {arc}
            </span>
          ))}
        </div>

        {/* pack badge — shows when playdate is in an unpurchased pack */}
        {show("packInfo") && packInfo && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sienna/8 px-2 py-px text-2xs font-medium text-sienna/70 mb-2">
            {packInfo.packTitle}
          </span>
        )}

        {/* bottom metadata — pushed to card bottom */}
        <div className="mt-auto flex items-center gap-2 text-2xs text-cadet/50 pt-2 border-t border-cadet/5">
          {show("energyLevel") && frictionDial !== null && (() => {
            const energy = getEnergyLabel(frictionDial);
            return energy ? (
              <span title={`energy level ${frictionDial}/5`}>
                {energy.label}
              </span>
            ) : null;
          })()}
          {show("startIn120s") && startIn120s && <span>ready in 2 min</span>}
          {show("findAgain") && hasFindAgain && (
            <span className="inline-block rounded-full bg-sienna/10 px-1.5 py-px text-2xs font-medium text-sienna">
              find again
            </span>
          )}
          {show("runCount") && !!runCount && runCount > 0 && (
            runCount >= 5 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-sienna/15 px-1.5 py-px text-2xs font-semibold text-sienna">
                popular
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-cadet/8 px-1.5 py-px text-2xs font-medium text-cadet/60">
                {runCount} {runCount === 1 ? "try" : "tries"}
              </span>
            )
          )}
          {show("evidenceCount") && !!evidenceCount && evidenceCount > 0 && (
            <span className="text-2xs text-cadet/40">
              {evidenceCount} piece{evidenceCount !== 1 ? "s" : ""}
            </span>
          )}
          {show("familyCount") && !!family_count && family_count > 0 && (
            <span className="text-2xs text-cadet/40">
              {family_count} {family_count === 1 ? "family" : "families"}
            </span>
          )}
        </div>

        {/* optional action slot (e.g. quick-log button) */}
        {action && <CardActionSlot>{action}</CardActionSlot>}
      </div>
    </Link>
  );
}
