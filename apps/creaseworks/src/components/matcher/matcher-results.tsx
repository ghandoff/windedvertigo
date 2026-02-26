"use client";

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
  // loading skeleton
  if (loading) {
    return (
      <div className="mt-8 sm:mt-12 space-y-3" aria-busy="true" aria-label="loading results">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border animate-pulse h-32"
            style={{
              borderColor: "rgba(39, 50, 72, 0.06)",
              backgroundColor: "rgba(39, 50, 72, 0.04)",
            }}
          />
        ))}
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
          {results.ranked.length} playdate
          {results.ranked.length !== 1 ? "s" : ""} found
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
          style={{ borderColor: "rgba(39, 50, 72, 0.1)", backgroundColor: "var(--wv-white)" }}
        >
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
          >
            {results.meta.contextFiltersApplied.length > 0
              ? `no playdates match all of your setting constraints — try removing ${results.meta.contextFiltersApplied.join(" or ")} to see more.`
              : selectedMaterialsSize > 3
                ? "we couldn't find a perfect fit — try selecting fewer materials to broaden the search."
                : "nothing matched yet. try adding more materials or changing where you're playing."}
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {results.ranked.map((playdate) => (
            <MatcherResultCard
              key={playdate.playdateId}
              playdate={playdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
