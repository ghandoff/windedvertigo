"use client";

/**
 * Matcher results — loading skeleton, empty state, and staggered card list.
 *
 * Session 31: aesthetic refresh — warm loading skeleton with champagne pulse,
 * staggered card entry animations (fadeInUp), playful empty-state messaging
 * with decorative accent, and a celebratory heading for results.
 */

import MatcherResultCard from "@/components/ui/matcher-result-card";
import { MatcherResult } from "./types";

interface MatcherResultsProps {
  results: MatcherResult | null;
  loading: boolean;
  resultsRef: React.RefObject<HTMLDivElement>;
  selectedMaterialsSize: number;
}

export function MatcherResults({
  results,
  loading,
  resultsRef,
  selectedMaterialsSize,
}: MatcherResultsProps) {
  // loading skeleton — warm champagne tones instead of grey
  if (loading) {
    return (
      <div className="mt-8 sm:mt-12 space-y-3" aria-busy="true" aria-label="loading results">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border animate-pulse"
            style={{
              borderColor: "rgba(203, 120, 88, 0.1)",
              backgroundColor: "rgba(255, 235, 210, 0.25)",
              height: i === 1 ? 140 : i === 2 ? 120 : 100,
              animationDelay: `${(i - 1) * 150}ms`,
              animationFillMode: "both",
            }}
          >
            {/* faux content lines inside skeleton */}
            <div className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="rounded-lg w-11 h-11 sm:w-14 sm:h-14 animate-pulse"
                  style={{ backgroundColor: "rgba(203, 120, 88, 0.15)" }}
                />
                <div className="flex-1 space-y-2">
                  <div
                    className="h-4 rounded-full animate-pulse"
                    style={{
                      backgroundColor: "rgba(203, 120, 88, 0.12)",
                      width: `${65 - i * 10}%`,
                    }}
                  />
                  <div
                    className="h-3 rounded-full animate-pulse"
                    style={{
                      backgroundColor: "rgba(203, 120, 88, 0.08)",
                      width: `${45 - i * 5}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
        <p
          className="text-xs text-center pt-2"
          style={{ color: "var(--wv-sienna)", opacity: 0.5 }}
        >
          searching through playdates…
        </p>
      </div>
    );
  }

  // no results yet
  if (!results) {
    return null;
  }

  // results display
  return (
    <div ref={resultsRef} className="mt-8 sm:mt-12" role="region" aria-label="matcher results" aria-live="polite">
      <div className="mb-4 sm:mb-6">
        <h2
          className="text-lg sm:text-xl font-semibold tracking-tight mb-1"
          style={{ color: "var(--wv-cadet)" }}
        >
          {results.ranked.length > 0 ? (
            <>
              <span style={{ color: "var(--wv-redwood)" }}>{results.ranked.length}</span>{" "}
              playdate{results.ranked.length !== 1 ? "s" : ""} found
            </>
          ) : (
            <>0 playdates found</>
          )}
        </h2>
        <p
          className="text-xs"
          style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
        >
          searched {results.meta.totalCandidates} playdates
          {results.meta.contextFiltersApplied.length > 0 &&
            ` · ${results.meta.totalAfterFilter} fit your setting (${results.meta.contextFiltersApplied.join(", ")})`}
        </p>
      </div>

      {results.ranked.length === 0 ? (
        <div
          className="rounded-xl border p-6 sm:p-8 text-center"
          style={{
            borderColor: "rgba(203, 120, 88, 0.15)",
            backgroundColor: "rgba(255, 235, 210, 0.12)",
          }}
        >
          {/* decorative dots */}
          <div className="flex items-center justify-center gap-1.5 mb-3">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: "var(--wv-sienna)", opacity: 0.25 }}
            />
            <div
              className="w-1 h-1 rounded-full"
              style={{ backgroundColor: "var(--wv-redwood)", opacity: 0.2 }}
            />
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: "var(--wv-sienna)", opacity: 0.25 }}
            />
          </div>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--wv-cadet)", opacity: 0.6 }}
          >
            {results.meta.contextFiltersApplied.length > 0
              ? `no playdates match all of your setting constraints — try removing ${results.meta.contextFiltersApplied.join(" or ")} to see more.`
              : selectedMaterialsSize > 3
                ? "hmm, we couldn't quite find a perfect fit — try selecting fewer materials to broaden the search."
                : "nothing matched yet — try adding more materials or changing where you're playing."}
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {results.ranked.map((playdate, index) => (
            <div
              key={playdate.playdateId}
              style={{
                animation: "matcherFadeInUp 350ms ease-out both",
                animationDelay: `${index * 40}ms`,
              }}
            >
              <MatcherResultCard playdate={playdate} />
            </div>
          ))}
        </div>
      )}

      {/* keyframes for staggered card entry */}
      <style>{`
        @keyframes matcherFadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes matcherFadeInUp {
            from { opacity: 1; transform: none; }
            to   { opacity: 1; transform: none; }
          }
        }
      `}</style>
    </div>
  );
}
