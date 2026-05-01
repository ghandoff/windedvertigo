"use client";

/**
 * Matcher results — playful loading, celebratory reveal, encouraging empty state.
 *
 * Loading: animated "searching" messages with rotating emojis.
 * Results: staggered card entry with a cheerful heading.
 * Empty: helpful, non-discouraging suggestions.
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
  /* ── loading state ─────────────────────────────────── */
  if (loading) {
    return (
      <div
        className="mt-10 sm:mt-14"
        aria-busy="true"
        aria-label="loading results"
      >
        {/* playful searching animation */}
        <div className="text-center mb-6">
          <div
            className="inline-block text-4xl mb-3"
            style={{
              animation: "searchBounce 800ms ease-in-out infinite alternate",
            }}
          >
            🔮
          </div>
          <p
            className="text-sm font-medium"
            style={{ color: "var(--wv-sienna)" }}
          >
            searching through playdates…
          </p>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--color-text-on-cream-muted)" }}
          >
            finding the best ones for your stuff
          </p>
        </div>

        {/* skeleton cards with warm tones */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border-2 animate-pulse"
              style={{
                borderColor: "rgba(39, 50, 72, 0.06)",
                backgroundColor: "rgba(255, 246, 232, 0.6)",
                height: i === 1 ? 150 : i === 2 ? 130 : 110,
                animationDelay: `${(i - 1) * 200}ms`,
                animationFillMode: "both",
              }}
            >
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="rounded-xl w-12 h-12 animate-pulse"
                    style={{ backgroundColor: "rgba(203, 120, 88, 0.12)" }}
                  />
                  <div className="flex-1 space-y-2">
                    <div
                      className="h-4 rounded-full animate-pulse"
                      style={{
                        backgroundColor: "rgba(203, 120, 88, 0.1)",
                        width: `${70 - i * 10}%`,
                      }}
                    />
                    <div
                      className="h-3 rounded-full animate-pulse"
                      style={{
                        backgroundColor: "rgba(203, 120, 88, 0.06)",
                        width: `${50 - i * 5}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── no results yet ────────────────────────────────── */
  if (!results) return null;

  /* ── results display ───────────────────────────────── */
  return (
    <div
      ref={resultsRef}
      className="mt-10 sm:mt-14"
      role="region"
      aria-label="matcher results"
      aria-live="polite"
    >
      {/* heading */}
      <div className="mb-6">
        <h2
          className="text-xl sm:text-2xl font-bold tracking-tight mb-1"
          style={{ color: "var(--wv-cadet)" }}
        >
          {results.ranked.length > 0 ? (
            <>
              <span style={{ color: "var(--wv-redwood)" }}>
                {results.ranked.length}
              </span>{" "}
              playdate{results.ranked.length !== 1 ? "s" : ""} found!{" "}
              <span
                className="inline-block"
                style={{
                  animation:
                    "celebrationBounce 600ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                🎉
              </span>
            </>
          ) : (
            <>hmm, no exact matches</>
          )}
        </h2>
        <p
          className="text-xs"
          style={{ color: "var(--color-text-on-cream-muted)" }}
        >
          looked through {results.meta.totalCandidates} playdates
          {results.meta.contextFiltersApplied.length > 0 &&
            ` · ${results.meta.totalAfterFilter} work in your spot (${results.meta.contextFiltersApplied.join(", ")})`}
        </p>
      </div>

      {results.ranked.length === 0 ? (
        /* ── encouraging empty state ────────────────────── */
        <div
          className="rounded-2xl border-2 border-dashed p-8 text-center"
          style={{
            borderColor: "rgba(39, 50, 72, 0.1)",
            backgroundColor: "rgba(255, 246, 232, 0.5)",
          }}
        >
          {/* magnifying-glass illustration */}
          <svg
            viewBox="0 0 80 60"
            width={80}
            height={60}
            className="mx-auto mb-4"
            aria-hidden="true"
          >
            <circle cx="34" cy="26" r="14" fill="none" stroke="var(--wv-sienna)" strokeWidth="1.5" opacity="0.4" />
            <circle cx="34" cy="26" r="10" fill="var(--wv-cream)" opacity="0.8" />
            <line x1="44" y1="36" x2="56" y2="48" stroke="var(--wv-sienna)" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
            <text x="34" y="30" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="600" fill="var(--wv-sienna)" opacity="0.25">?</text>
            <circle cx="60" cy="14" r="1.5" fill="var(--wv-sienna)" opacity="0.12" />
            <circle cx="66" cy="22" r="1" fill="var(--wv-sienna)" opacity="0.1" />
            <circle cx="14" cy="42" r="1.2" fill="var(--wv-sienna)" opacity="0.1" />
          </svg>
          <p
            className="text-sm leading-relaxed max-w-md mx-auto"
            style={{ color: "var(--wv-cadet)", opacity: 0.6 }}
          >
            {results.meta.contextFiltersApplied.length > 0
              ? `we couldn't find a playdate that works in "${results.meta.contextFiltersApplied.join(" + ")}" with your stuff — try removing a place to see more!`
              : selectedMaterialsSize > 3
                ? "that's a lot of specific stuff! try picking fewer things to see what comes up."
                : "nothing matched yet — try adding more stuff or picking a different spot. the more you add, the more we can find!"}
          </p>
        </div>
      ) : (
        /* ── result cards ───────────────────────────────── */
        <div className="space-y-4">
          {results.ranked.map((playdate, index) => (
            <div
              key={playdate.playdateId}
              style={{
                animation: "matcherFadeInUp 400ms ease-out both",
                animationDelay: `${index * 60}ms`,
              }}
            >
              <MatcherResultCard playdate={playdate} />
            </div>
          ))}
        </div>
      )}

      {/* keyframes */}
      <style>{`
        @keyframes matcherFadeInUp {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes searchBounce {
          from { transform: translateY(0); }
          to   { transform: translateY(-8px); }
        }
        @keyframes celebrationBounce {
          0%   { transform: scale(0); }
          50%  { transform: scale(1.3) rotate(10deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes matcherFadeInUp { from, to { opacity: 1; transform: none; } }
          @keyframes searchBounce { from, to { transform: none; } }
          @keyframes celebrationBounce { from, to { transform: scale(1); } }
        }
      `}</style>
    </div>
  );
}
