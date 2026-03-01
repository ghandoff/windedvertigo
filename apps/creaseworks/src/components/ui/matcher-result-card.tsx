"use client";

/**
 * Matcher result card — playful, warm, child-friendly.
 *
 * Replaces the numeric score with a visual match quality indicator
 * (stars + color), uses friendlier language, bigger touch targets,
 * and more inviting CTAs.
 */

import { useState } from "react";
import Link from "next/link";

/* ── types ─────────────────────────────────────────────────────────── */

interface SubstitutionSuggestion {
  missingMaterial: string;
  availableAlternatives: { id: string; title: string }[];
}

interface Coverage {
  materialsCovered: { id: string; title: string }[];
  materialsMissing: { id: string; title: string; formPrimary: string }[];
  formsCovered: string[];
  formsMissing: string[];
  suggestedSubstitutions: SubstitutionSuggestion[];
}

interface RankedPlaydate {
  playdateId: string;
  slug: string;
  title: string;
  headline: string | null;
  score: number;
  primaryFunction: string | null;
  arcEmphasis: string[];
  frictionDial: number | null;
  startIn120s: boolean;
  coverage: Coverage;
  substitutionsNotes: string | null;
  hasFindAgain: boolean;
  findAgainMode: string | null;
  isEntitled: boolean;
  packSlugs: string[];
}

/* ── helpers ───────────────────────────────────────────────────────── */

/** Convert 0-100 score to a playful match quality label + emoji. */
function getMatchQuality(score: number) {
  if (score >= 80)
    return { label: "perfect match!", emoji: "🌟", stars: 3, color: "var(--wv-redwood)" };
  if (score >= 55)
    return { label: "great match", emoji: "⭐", stars: 2, color: "var(--wv-sienna)" };
  if (score >= 30)
    return { label: "good match", emoji: "✨", stars: 1, color: "var(--wv-champagne)" };
  return { label: "worth a try", emoji: "💫", stars: 0, color: "rgba(39, 50, 72, 0.3)" };
}

/* ── component ─────────────────────────────────────────────────────── */

export default function MatcherResultCard({
  playdate,
}: {
  playdate: RankedPlaydate;
}) {
  const { coverage } = playdate;
  const match = getMatchQuality(playdate.score);
  const hasCoverageDetail =
    coverage.materialsCovered.length > 0 ||
    coverage.materialsMissing.length > 0 ||
    coverage.formsCovered.length > 0 ||
    coverage.formsMissing.length > 0;

  const [coverageOpen, setCoverageOpen] = useState(false);

  return (
    <div
      role="group"
      aria-label={`${playdate.title} — ${match.label}`}
      className="rounded-2xl border-2 p-5"
      style={{
        borderColor: "rgba(39, 50, 72, 0.08)",
        backgroundColor: "var(--wv-white)",
        transition: "all 250ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow =
          "0 6px 24px rgba(203, 120, 88, 0.12)";
        e.currentTarget.style.borderColor = "rgba(203, 120, 88, 0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "rgba(39, 50, 72, 0.08)";
      }}
    >
      {/* ── header: match quality + title ──────────────── */}
      <div className="flex items-start gap-3">
        {/* match quality badge — visual, not numeric */}
        <div
          className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl w-14 h-14"
          style={{
            backgroundColor: `${match.color}18`,
          }}
        >
          <span className="text-xl leading-none">{match.emoji}</span>
          <span
            className="text-[9px] font-bold mt-0.5 tracking-wider"
            style={{ color: match.color }}
          >
            {playdate.score}%
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <h3
            className="text-base sm:text-lg font-bold tracking-tight leading-snug"
            style={{ color: "var(--wv-cadet)" }}
          >
            {playdate.title}
          </h3>
          {playdate.headline && (
            <p
              className="text-sm mt-0.5 line-clamp-2"
              style={{ color: "var(--wv-cadet)", opacity: 0.55 }}
            >
              {playdate.headline}
            </p>
          )}
          {/* match quality label */}
          <p
            className="text-xs font-medium mt-1"
            style={{ color: match.color }}
          >
            {match.label}
          </p>
        </div>
      </div>

      {/* ── tags row ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        {playdate.primaryFunction && (
          <span
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              backgroundColor: "var(--wv-champagne)",
              color: "var(--wv-cadet)",
            }}
          >
            {playdate.primaryFunction}
          </span>
        )}
        {playdate.arcEmphasis.map((arc) => (
          <span
            key={arc}
            className="rounded-full px-3 py-1.5 text-xs"
            style={{
              backgroundColor: "rgba(39, 50, 72, 0.05)",
              color: "var(--wv-cadet)",
              opacity: 0.7,
            }}
          >
            {arc}
          </span>
        ))}
        {playdate.startIn120s && (
          <span
            className="rounded-full px-3 py-1.5 text-xs font-bold"
            style={{
              backgroundColor: "rgba(177, 80, 67, 0.1)",
              color: "var(--wv-redwood)",
            }}
          >
            ⚡ ready in 2 min
          </span>
        )}
        {playdate.frictionDial != null && (
          <span
            className="text-xs px-1"
            style={{ color: "var(--wv-cadet)", opacity: 0.35 }}
          >
            {"🟢🟡🟠🔴🔴".charAt(playdate.frictionDial - 1) || "🟢"}{" "}
            effort {playdate.frictionDial}/5
          </span>
        )}
        {playdate.hasFindAgain &&
          (playdate.isEntitled && playdate.findAgainMode ? (
            <span
              className="rounded-full px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: "rgba(177, 80, 67, 0.1)",
                color: "var(--wv-redwood)",
              }}
            >
              🔄 find again: {playdate.findAgainMode}
            </span>
          ) : (
            <span
              className="rounded-full px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: "rgba(203, 120, 88, 0.1)",
                color: "var(--wv-sienna)",
              }}
            >
              ✨ includes find again
            </span>
          ))}
      </div>

      {/* ── coverage detail ────────────────────────────── */}
      {hasCoverageDetail && (
        <div
          className="mt-3 pt-3 border-t"
          style={{ borderColor: "rgba(39, 50, 72, 0.05)" }}
        >
          {/* mobile toggle */}
          <button
            type="button"
            onClick={() => setCoverageOpen(!coverageOpen)}
            aria-expanded={coverageOpen}
            className="flex items-center gap-1.5 text-xs font-medium sm:hidden mb-2"
            style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              className="transition-transform duration-200"
              style={{
                transform: coverageOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {coverageOpen ? "hide details" : "what you need"}
            <span style={{ opacity: 0.7 }}>
              ({coverage.materialsCovered.length} of{" "}
              {coverage.materialsCovered.length +
                coverage.materialsMissing.length}{" "}
              materials)
            </span>
          </button>

          <div className={`${coverageOpen ? "" : "hidden"} sm:block`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {(coverage.materialsCovered.length > 0 ||
                coverage.materialsMissing.length > 0) && (
                <div>
                  <h4
                    className="font-bold mb-1"
                    style={{ color: "var(--wv-cadet)", opacity: 0.55 }}
                  >
                    materials
                  </h4>
                  <div className="space-y-0.5">
                    {coverage.materialsCovered.map((m) => (
                      <div
                        key={m.id}
                        style={{ color: "var(--wv-cadet)", opacity: 0.7 }}
                      >
                        <span style={{ color: "var(--color-success-vivid)" }}>
                          ✓
                        </span>{" "}
                        {m.title}
                      </div>
                    ))}
                    {coverage.materialsMissing.map((m) => (
                      <div
                        key={m.id}
                        style={{ color: "var(--wv-cadet)", opacity: 0.45 }}
                      >
                        <span style={{ color: "var(--wv-redwood)" }}>✗</span>{" "}
                        {m.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(coverage.formsCovered.length > 0 ||
                coverage.formsMissing.length > 0) && (
                <div>
                  <h4
                    className="font-bold mb-1"
                    style={{ color: "var(--wv-cadet)", opacity: 0.55 }}
                  >
                    types
                  </h4>
                  <div className="space-y-0.5">
                    {coverage.formsCovered.map((f) => (
                      <div
                        key={f}
                        style={{ color: "var(--wv-cadet)", opacity: 0.7 }}
                      >
                        <span style={{ color: "var(--color-success-vivid)" }}>
                          ✓
                        </span>{" "}
                        {f}
                      </div>
                    ))}
                    {coverage.formsMissing.map((f) => (
                      <div
                        key={f}
                        style={{ color: "var(--wv-cadet)", opacity: 0.45 }}
                      >
                        <span style={{ color: "var(--wv-redwood)" }}>✗</span>{" "}
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── substitution suggestions ───────────────────── */}
      {coverage.suggestedSubstitutions.length > 0 && (
        <div
          className="mt-3 rounded-xl p-4 text-xs"
          style={{
            backgroundColor: "var(--wv-champagne)",
            color: "var(--wv-cadet)",
          }}
        >
          <h4 className="font-bold mb-1">💡 swap ideas</h4>
          {coverage.suggestedSubstitutions.map((sub, i) => (
            <p key={i} style={{ opacity: 0.8 }}>
              instead of <strong>{sub.missingMaterial}</strong>, try{" "}
              {sub.availableAlternatives.map((a) => a.title).join(" or ")}
            </p>
          ))}
        </div>
      )}

      {/* ── author substitution notes ──────────────────── */}
      {playdate.isEntitled && playdate.substitutionsNotes && (
        <div
          className="mt-3 rounded-xl p-4 text-xs"
          style={{
            backgroundColor: "rgba(177, 80, 67, 0.05)",
            color: "var(--wv-cadet)",
          }}
        >
          <h4
            className="font-bold mb-1"
            style={{ color: "var(--wv-redwood)" }}
          >
            🔧 tips on swapping materials
          </h4>
          <p style={{ opacity: 0.8 }}>{playdate.substitutionsNotes}</p>
        </div>
      )}

      {/* ── CTAs ───────────────────────────────────────── */}
      {playdate.packSlugs.length > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          {playdate.isEntitled
            ? playdate.packSlugs.map((slug) => (
                <Link
                  key={slug}
                  href={`/packs/${slug}/playdates/${playdate.slug}`}
                  className="flex items-center justify-center rounded-xl px-5 py-3.5 text-sm font-bold transition-all hover:opacity-90 active:scale-[0.97]"
                  style={{
                    backgroundColor: "var(--wv-redwood)",
                    color: "var(--wv-white)",
                    minHeight: 48,
                    boxShadow: "0 2px 12px rgba(177, 80, 67, 0.2)",
                  }}
                >
                  let&apos;s make this! →
                </Link>
              ))
            : playdate.packSlugs.map((slug) => (
                <Link
                  key={slug}
                  href={`/packs/${slug}`}
                  className="flex items-center justify-center rounded-xl px-5 py-3.5 text-sm font-bold transition-all hover:opacity-90 active:scale-[0.97]"
                  style={{
                    backgroundColor: "transparent",
                    color: "var(--wv-redwood)",
                    border: "2px solid var(--wv-redwood)",
                    minHeight: 48,
                  }}
                >
                  see the pack →
                </Link>
              ))}
        </div>
      )}

      {/* sampler-only playdates */}
      {playdate.packSlugs.length === 0 && (
        <div className="mt-4">
          <Link
            href={`/sampler/${playdate.slug}`}
            className="inline-flex items-center justify-center rounded-xl px-5 py-3.5 text-sm font-bold transition-opacity hover:opacity-80 active:scale-[0.97]"
            style={{ color: "var(--wv-redwood)", minHeight: 48 }}
          >
            check it out →
          </Link>
        </div>
      )}
    </div>
  );
}
