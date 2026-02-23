/**
 * Tier card — displays one subscription tier with features,
 * price, and a CTA. Used on the profile page to show the
 * user's current plan and available upgrades.
 */

import Link from "next/link";

/* ── tier definitions ────────────────────────────────────────────── */

export type TierState = "current" | "available" | "locked";

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
      "all patterns unlocked",
    ],
  },
];

/* ── component ──────────────────────────────────────────────────── */

export default function TierCard({
  tier,
  state,
}: {
  tier: TierDef;
  state: TierState;
}) {
  const isCurrent = state === "current";
  const isAvailable = state === "available";

  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-3 transition-all duration-200"
      style={{
        backgroundColor: isCurrent
          ? "rgba(255, 235, 210, 0.3)"
          : isAvailable
            ? "#ffffff"
            : "rgba(39, 50, 72, 0.02)",
        borderColor: isCurrent
          ? "rgba(203, 120, 88, 0.3)"
          : isAvailable
            ? "rgba(39, 50, 72, 0.1)"
            : "rgba(39, 50, 72, 0.05)",
        boxShadow: isCurrent
          ? "var(--shadow-warm)"
          : isAvailable
            ? "var(--shadow-soft)"
            : "none",
        opacity: state === "locked" ? 0.55 : 1,
      }}
    >
      {/* header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold tracking-tight" style={{ color: "var(--wv-cadet)" }}>
          {tier.name}
        </h4>
        {isCurrent && (
          <span
            className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: "rgba(203, 120, 88, 0.15)",
              color: "var(--wv-sienna)",
            }}
          >
            current
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
                stroke={isCurrent ? "var(--wv-sienna)" : "rgba(39, 50, 72, 0.3)"}
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
        {isCurrent ? (
          <span
            className="block text-center text-xs font-semibold py-2 rounded-lg"
            style={{
              backgroundColor: "rgba(203, 120, 88, 0.1)",
              color: "var(--wv-sienna)",
            }}
          >
            your current plan
          </span>
        ) : isAvailable ? (
          <Link
            href="/packs"
            className="block text-center text-xs font-semibold py-2 rounded-lg transition-colors"
            style={{
              backgroundColor: "var(--wv-redwood)",
              color: "var(--wv-white)",
            }}
          >
            upgrade
          </Link>
        ) : (
          <span
            className="block text-center text-xs font-semibold py-2 rounded-lg"
            style={{
              backgroundColor: "rgba(39, 50, 72, 0.04)",
              color: "rgba(39, 50, 72, 0.3)",
            }}
          >
            coming soon
          </span>
        )}
      </div>
    </div>
  );
}
