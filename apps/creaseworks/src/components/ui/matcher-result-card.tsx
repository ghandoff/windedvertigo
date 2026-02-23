"use client";

/**
 * Matcher result card — displays a single ranked pattern.
 *
 * Shows score, coverage breakdown, substitution suggestions,
 * find-again teaser, and entitlement-aware links.
 *
 * MVP 3 — matcher.
 * Session 12: mobile-first responsive redesign — stacked score+title
 *   on small screens, collapsible coverage detail, larger CTA touch
 *   targets, and improved tag wrapping.
 */

import { useState } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  types (matches MatcherResult.ranked[n] from the API)              */
/* ------------------------------------------------------------------ */

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

interface RankedPattern {
  patternId: string;
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

/* ------------------------------------------------------------------ */
/*  component                                                          */
/* ------------------------------------------------------------------ */

export default function MatcherResultCard({
  pattern,
}: {
  pattern: RankedPattern;
}) {
  const { coverage } = pattern;
  const hasCoverageDetail =
    coverage.materialsCovered.length > 0 ||
    coverage.materialsMissing.length > 0 ||
    coverage.formsCovered.length > 0 ||
    coverage.formsMissing.length > 0;

  // on mobile, coverage detail is collapsed by default to save space
  const [coverageOpen, setCoverageOpen] = useState(false);

  return (
    <div
      className="rounded-xl border bg-white p-4 sm:p-5 transition-all hover:shadow-md"
      style={{ borderColor: "rgba(39, 50, 72, 0.1)" }}
    >
      {/* header: score + title — stacked on mobile, side-by-side on sm+ */}
      <div className="flex items-start gap-3 sm:gap-4">
        {/* score badge — slightly smaller on mobile */}
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-lg w-11 h-11 sm:w-14 sm:h-14 text-base sm:text-lg font-bold"
          style={{
            backgroundColor:
              pattern.score >= 70
                ? "var(--wv-redwood)"
                : pattern.score >= 40
                  ? "var(--wv-sienna)"
                  : "rgba(39, 50, 72, 0.1)",
            color: pattern.score >= 40 ? "var(--wv-white)" : "var(--wv-cadet)",
          }}
        >
          {pattern.score}
        </div>

        <div className="flex-1 min-w-0">
          <h3
            className="text-base sm:text-lg font-semibold tracking-tight leading-snug"
            style={{ color: "var(--wv-cadet)" }}
          >
            {pattern.title}
          </h3>
          {pattern.headline && (
            <p
              className="text-sm mt-0.5 line-clamp-2"
              style={{ color: "var(--wv-cadet)", opacity: 0.6 }}
            >
              {pattern.headline}
            </p>
          )}
        </div>
      </div>

      {/* tags row — wraps naturally, slightly larger on mobile */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        {pattern.primaryFunction && (
          <span
            className="rounded-full px-2.5 py-1 sm:px-2 sm:py-0.5 text-xs"
            style={{ backgroundColor: "var(--wv-champagne)", color: "var(--wv-cadet)" }}
          >
            {pattern.primaryFunction}
          </span>
        )}
        {pattern.arcEmphasis.map((arc) => (
          <span
            key={arc}
            className="rounded-full px-2.5 py-1 sm:px-2 sm:py-0.5 text-xs"
            style={{
              backgroundColor: "rgba(39, 50, 72, 0.06)",
              color: "var(--wv-cadet)",
              opacity: 0.7,
            }}
          >
            {arc}
          </span>
        ))}
        {pattern.startIn120s && (
          <span
            className="rounded-full px-2.5 py-1 sm:px-2 sm:py-0.5 text-xs font-medium"
            style={{
              backgroundColor: "rgba(177, 80, 67, 0.1)",
              color: "var(--wv-redwood)",
            }}
          >
            ready in 2 min
          </span>
        )}
        {pattern.frictionDial != null && (
          <span
            className="text-xs px-1"
            style={{ color: "var(--wv-cadet)", opacity: 0.4 }}
          >
            friction {pattern.frictionDial}/5
          </span>
        )}
        {pattern.hasFindAgain &&
          (pattern.isEntitled && pattern.findAgainMode ? (
            <span
              className="rounded-full px-2.5 py-1 sm:px-2 sm:py-0.5 text-xs font-medium"
              style={{
                backgroundColor: "rgba(177, 80, 67, 0.1)",
                color: "var(--wv-redwood)",
              }}
            >
              find again: {pattern.findAgainMode}
            </span>
          ) : (
            <span
              className="rounded-full px-2.5 py-1 sm:px-2 sm:py-0.5 text-xs font-medium"
              style={{
                backgroundColor: "rgba(203, 120, 88, 0.1)",
                color: "var(--wv-sienna)",
              }}
            >
              includes find again
            </span>
          ))}
      </div>

      {/* coverage detail — collapsible on mobile */}
      {hasCoverageDetail && (
        <div
          className="mt-3 pt-3 border-t"
          style={{ borderColor: "rgba(39, 50, 72, 0.06)" }}
        >
          {/* mobile: toggle button */}
          <button
            type="button"
            onClick={() => setCoverageOpen(!coverageOpen)}
            className="flex items-center gap-1.5 text-xs font-medium sm:hidden mb-2"
            style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              className="transition-transform duration-150"
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
            {coverageOpen ? "hide what you need" : "show what you need"}
            <span style={{ opacity: 0.7 }}>
              ({coverage.materialsCovered.length} of{" "}
              {coverage.materialsCovered.length +
                coverage.materialsMissing.length}{" "}
              materials)
            </span>
          </button>

          {/* desktop: always visible. mobile: collapsible */}
          <div className={`${coverageOpen ? "" : "hidden"} sm:block`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* materials coverage */}
              {(coverage.materialsCovered.length > 0 ||
                coverage.materialsMissing.length > 0) && (
                <div>
                  <h4
                    className="font-medium mb-1"
                    style={{ color: "var(--wv-cadet)", opacity: 0.6 }}
                  >
                    materials
                  </h4>
                  <div className="space-y-0.5">
                    {coverage.materialsCovered.map((m) => (
                      <div
                        key={m.id}
                        style={{ color: "var(--wv-cadet)", opacity: 0.7 }}
                      >
                        <span style={{ color: "var(--color-success-vivid)" }}>✓</span> {m.title}
                      </div>
                    ))}
                    {coverage.materialsMissing.map((m) => (
                      <div
                        key={m.id}
                        style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
                      >
                        <span style={{ color: "var(--wv-redwood)" }}>✗</span> {m.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* forms coverage */}
              {(coverage.formsCovered.length > 0 ||
                coverage.formsMissing.length > 0) && (
                <div>
                  <h4
                    className="font-medium mb-1"
                    style={{ color: "var(--wv-cadet)", opacity: 0.6 }}
                  >
                    forms
                  </h4>
                  <div className="space-y-0.5">
                    {coverage.formsCovered.map((f) => (
                      <div
                        key={f}
                        style={{ color: "var(--wv-cadet)", opacity: 0.7 }}
                      >
                        <span style={{ color: "var(--color-success-vivid)" }}>✓</span> {f}
                      </div>
                    ))}
                    {coverage.formsMissing.map((f) => (
                      <div
                        key={f}
                        style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
                      >
                        <span style={{ color: "var(--wv-redwood)" }}>✗</span> {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* substitution suggestions */}
      {coverage.suggestedSubstitutions.length > 0 && (
        <div
          className="mt-3 rounded-lg p-3 text-xs"
          style={{ backgroundColor: "var(--wv-champagne)", color: "var(--wv-cadet)" }}
        >
          <h4 className="font-medium mb-1">swap ideas</h4>
          {coverage.suggestedSubstitutions.map((sub, i) => (
            <p key={i} style={{ opacity: 0.8 }}>
              instead of <strong>{sub.missingMaterial}</strong>, try{" "}
              {sub.availableAlternatives.map((a) => a.title).join(" or ")}
            </p>
          ))}
        </div>
      )}

      {/* entitled: substitutions notes from author */}
      {pattern.isEntitled && pattern.substitutionsNotes && (
        <div
          className="mt-3 rounded-lg p-3 text-xs"
          style={{
            backgroundColor: "rgba(177, 80, 67, 0.05)",
            color: "var(--wv-cadet)",
          }}
        >
          <h4 className="font-medium mb-1" style={{ color: "var(--wv-redwood)" }}>
            tips on swapping materials
          </h4>
          <p style={{ opacity: 0.8 }}>{pattern.substitutionsNotes}</p>
        </div>
      )}

      {/* pack links / CTA — full-width on mobile for easy tapping */}
      {pattern.packSlugs.length > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          {pattern.isEntitled
            ? pattern.packSlugs.map((slug) => (
                <Link
                  key={slug}
                  href={`/packs/${slug}/patterns/${pattern.slug}`}
                  className="flex items-center justify-center rounded-lg px-4 py-3 sm:px-3 sm:py-1.5 text-sm sm:text-xs font-medium transition-all hover:opacity-80 active:scale-[0.98]"
                  style={{
                    backgroundColor: "var(--wv-redwood)",
                    color: "var(--wv-white)",
                    minHeight: 44,
                  }}
                >
                  see full playdate →
                </Link>
              ))
            : pattern.packSlugs.map((slug) => (
                <Link
                  key={slug}
                  href={`/packs/${slug}`}
                  className="flex items-center justify-center rounded-lg px-4 py-3 sm:px-3 sm:py-1.5 text-sm sm:text-xs font-medium transition-all hover:opacity-80 active:scale-[0.98]"
                  style={{
                    backgroundColor: "transparent",
                    color: "var(--wv-redwood)",
                    border: "1px solid var(--wv-redwood)",
                    minHeight: 44,
                  }}
                >
                  get the pack →
                </Link>
              ))}
        </div>
      )}

      {/* sampler-only patterns (no pack) link to sampler */}
      {pattern.packSlugs.length === 0 && (
        <div className="mt-4">
          <Link
            href={`/sampler/${pattern.slug}`}
            className="inline-flex items-center justify-center rounded-lg px-4 py-3 sm:px-0 sm:py-0 text-sm sm:text-xs font-medium transition-opacity hover:opacity-80 active:scale-[0.98]"
            style={{ color: "var(--wv-redwood)", minHeight: 44 }}
          >
            view in sampler →
          </Link>
        </div>
      )}
    </div>
  );
}
