/**
 * Tier card — displays one subscription tier with features,
 * price, and a CTA. Used on the profile page to show the
 * user's current plan, included tiers, and available upgrades.
 *
 * The whole card is clickable:
 *  - current → links to /packs (view your stuff)
 *  - included → links to /packs (already yours)
 *  - available → links to /packs (upgrade)
 */

import Link from "next/link";

/* ── tier definitions ────────────────────────────────────────────── */

export type TierState = "current" | "included" | "available";

export interface TierDef {
  key: string;
  name: string;
  price: string;        /* display price, e.g. "free" or "$29" */
  tagline: string;
  features: string[];
}

export const TIERS: TierDef[] = [
  {
    key: "sampler",
    name: "sampler",
    price: "free",
    tagline: "taste the toolkit",
    features: [
      "3 free playdates",
      "basic matcher",
      "browse collections",
    ],
  },
  {
    key: "explorer",
    name: "explorer",
    price: "$29",
    tagline: "unlock the full library",
    features: [
      "full playdate library",
      "matcher with saves",
      "all collections",
    ],
  },
  {
    key: "practitioner",
    name: "practitioner",
    price: "$49",
    tagline: "track and grow",
    features: [
      "everything in explorer",
      "playbook + run tracking",
      "evidence capture",
      "analytics dashboard",
    ],
  },
  {
    key: "collective",
    name: "collective",
    price: "$99",
    tagline: "behind the curtain",
    features: [
      "everything in practitioner",
      "design rationale",
      "developmental notes",
      "author notes",
      "all playdates unlocked",
    ],
  },
];

/* ── helpers ─────────────────────────────────────────────────────── */

/** Resolve the tier index so we can compare "higher" vs "lower" */
const TIER_ORDER: Record<string, number> = {
  sampler: 0,
  explorer: 1,
  practitioner: 2,
  collective: 3,
};

/** Given a session tier label, compute the state for each tier key */
export function getTierState(
  tierKey: string,
  currentTierLabel: string,
): TierState {
  const currentIdx =
    TIER_ORDER[currentTierLabel] ?? TIER_ORDER[currentTierLabel === "admin" ? "collective" : "sampler"] ?? 0;
  // admin maps to collective level
  const effectiveIdx =
    currentTierLabel === "admin" || currentTierLabel === "collective"
      ? 3
      : currentTierLabel === "entitled"
        ? 2 // entitled = practitioner level
        : 0;
  const tierIdx = TIER_ORDER[tierKey] ?? 0;

  if (tierIdx === effectiveIdx) return "current";
  if (tierIdx < effectiveIdx) return "included";
  return "available";
}

/* ── component ──────────────────────────────────────────────────── */

export default function TierCard({
  tier,
  state,
}: {
  tier: TierDef;
  state: TierState;
}) {
  const isCurrent = state === "current";
  const isIncluded = state === "included";
  const isAvailable = state === "available";

  /* CTA label + href */
  const ctaLabel = isCurrent
    ? "your current plan"
    : isIncluded
      ? "included"
      : "upgrade";
  const ctaHref = "/packs";

  return (
    <Link
      href={ctaHref}
      className="block rounded-xl border p-5 flex flex-col gap-3 transition-all duration-200 hover:shadow-md"
      style={{
        backgroundColor: isCurrent
          ? "rgba(255, 235, 210, 0.3)"
          : isAvailable
            ? "var(--wv-white)"
            : "var(--wv-white)",
        borderColor: isCurrent
          ? "rgba(203, 120, 88, 0.3)"
          : isAvailable
            ? "rgba(39, 50, 72, 0.1)"
            : "rgba(39, 50, 72, 0.06)",
        boxShadow: isCurrent
          ? "var(--shadow-warm)"
          : "var(--shadow-soft)",
        opacity: isIncluded ? 0.65 : 1,
      }}
    >
      {/* header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold tracking-tight" style={{ color: "var(--wv-cadet)" }}>
          {tier.name}
        </h4>
        {isCurrent && (
          <span
            className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: "rgba(203, 120, 88, 0.15)",
              color: "var(--wv-sienna)",
            }}
          >
            current
          </span>
        )}
        {isIncluded && (
          <span
            className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: "rgba(39, 50, 72, 0.06)",
              color: "rgba(39, 50, 72, 0.4)",
            }}
          >
            included
          </span>
        )}
      </div>

      {/* price + tagline */}
      <div>
        <span className="text-xl font-bold tracking-tight" style={{ color: "var(--wv-cadet)" }}>
          {tier.price}
        </span>
        <p className="text-xs mt-0.5" style={{ color: "rgba(39, 50, 72, 0.45)" }}>
          {tier.tagline}
        </p>
      </div>

      {/* features */}
      <ul className="flex flex-col gap-1.5 mt-1">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs" style={{ color: "var(--wv-cadet)" }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="flex-shrink-0 mt-px"
            >
              <path
                d="M3 7L6 10L11 4"
                stroke={
                  isCurrent
                    ? "var(--wv-sienna)"
                    : isIncluded
                      ? "rgba(39, 50, 72, 0.25)"
                      : "rgba(39, 50, 72, 0.3)"
                }
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="mt-auto pt-2">
        <span
          className="block text-center text-xs font-semibold py-2 rounded-lg"
          style={
            isCurrent
              ? {
                  backgroundColor: "rgba(203, 120, 88, 0.1)",
                  color: "var(--wv-sienna)",
                }
              : isAvailable
                ? {
                    backgroundColor: "var(--wv-redwood)",
                    color: "var(--wv-white)",
                  }
                : {
                    backgroundColor: "rgba(39, 50, 72, 0.04)",
                    color: "rgba(39, 50, 72, 0.35)",
                  }
          }
        >
          {ctaLabel}
        </span>
      </div>
    </Link>
  );
}
