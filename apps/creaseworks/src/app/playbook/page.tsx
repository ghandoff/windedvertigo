/**
 * My Playbook — the personal badge shelf and collection explorer.
 *
 * Three sections, vertically stacked:
 * 1. Progress summary (compact pills + arc coverage bar)
 * 2. Collections grid with per-user progress
 * 3. Recent reflections (condensed, links to full list)
 *
 * Quiet when empty, fills up as you play.
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth-helpers";
import {
  getCollectionsWithProgress,
  getUserProgressSummary,
  getArcCoverage,
  getNextSuggestion,
  recomputeUserProgress,
} from "@/lib/queries/collections";
import { getRunsForUser, type RunRow } from "@/lib/queries/runs";
import { getUserOnboardingStatus } from "@/lib/queries/users";
import CollectionCard from "@/components/ui/collection-card";
import PlaybookSearch from "@/components/playbook-search";
import FirstVisitBanner from "@/components/first-visit-banner";
import SeasonalBanner from "@/components/seasonal-banner";
import PackUpsellSection from "@/components/pack-upsell-section";
import { getUnownedPacks } from "@/lib/queries/packs";

export const dynamic = "force-dynamic";

export default async function PlaybookPage() {
  const session = await requireAuth();

  // Recompute progress from runs before rendering
  await recomputeUserProgress(session.userId);

  // Fetch everything in parallel (unownedPacks wrapped in try-catch to prevent page crash)
  const [collections, summary, arcs, suggestion, recentRuns, onboarding, unownedPacks] =
    await Promise.all([
      getCollectionsWithProgress(session.userId),
      getUserProgressSummary(session.userId),
      getArcCoverage(session.userId),
      getNextSuggestion(session.userId),
      getRunsForUser(session, 5, 0),
      getUserOnboardingStatus(session.userId),
      getUnownedPacks(session.orgId).catch((err) => {
        console.error("getUnownedPacks failed:", err);
        return [] as Awaited<ReturnType<typeof getUnownedPacks>>;
      }),
    ]);

  const hasProgress = summary.total_tried > 0;
  const hasPlayContexts = onboarding && onboarding.play_contexts.length > 0;

  return (
    <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
      {/* ── header ── */}
      <h1 className="text-3xl font-semibold tracking-tight mb-1">
        my playbook
      </h1>
      <p className="text-cadet/50 text-sm mb-8">
        your collections, badges, and play history — all in one place.
      </p>

      {/* ── first-visit banner for users with no play contexts ── */}
      {!hasPlayContexts && <FirstVisitBanner />}

      {/* ── section 1: progress summary ── */}
      {hasProgress && (
        <div className="mb-8">
          {/* stat pills */}
          <div className="flex flex-wrap gap-2 text-xs">
            <Pill label={`${summary.total_tried} tried`} />
            {summary.total_found > 0 && (
              <Pill label={`${summary.total_found} found`} accent="champagne" />
            )}
            {summary.total_folded > 0 && (
              <Pill label={`${summary.total_folded} folded`} accent="sienna" />
            )}
            {summary.total_found_again > 0 && (
              <Pill
                label={`${summary.total_found_again} found again`}
                accent="redwood"
              />
            )}
          </div>

          {/* arc coverage — subtle horizontal bar */}
          {arcs.length > 0 && (
            <div className="mt-4 flex gap-1 items-center">
              {arcs.map((a) => {
                const pct = a.total > 0 ? a.tried / a.total : 0;
                return (
                  <div
                    key={a.arc}
                    className="flex-1 group relative"
                    title={`${a.arc}: ${a.tried} of ${a.total}`}
                  >
                    <div className="h-1.5 rounded-full bg-cadet/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-champagne transition-all duration-700"
                        style={{
                          width: `${Math.round(pct * 100)}%`,
                          opacity: 0.3 + pct * 0.7,
                        }}
                      />
                    </div>
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-cadet/30 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {a.arc}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── suggestion nudge ── */}
      {suggestion && (
        <Link
          href={`/playbook/${suggestion.collection.slug}`}
          className="block mb-6 rounded-lg bg-champagne/15 px-4 py-3 text-sm text-cadet/60 hover:bg-champagne/25 transition-colors"
        >
          {suggestion.reason} — try{" "}
          <span className="font-medium text-cadet">
            {suggestion.collection.icon_emoji} {suggestion.collection.title}
          </span>{" "}
          &rarr;
        </Link>
      )}

      {/* ── section 2: collections grid ── */}
      <h2 className="text-lg font-semibold text-cadet mb-3">collections</h2>
      {collections.length === 0 ? (
        <p className="text-sm text-cadet/40 py-8 text-center">
          no collections yet. check back soon.
        </p>
      ) : (
        <PlaybookSearch collections={collections} hasProgress={hasProgress} />
      )}

      {/* ── portfolio link ── */}
      <Link
        href="/playbook/portfolio"
        className="block mb-8 rounded-xl border px-5 py-4 hover:shadow-warm transition-shadow"
        style={{
          borderColor: "rgba(203, 120, 88, 0.12)",
          backgroundColor: "rgba(203, 120, 88, 0.03)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-cadet">
              your portfolio
            </h3>
            <p className="text-xs text-cadet/40 mt-0.5">
              photos, quotes, and observations from your reflections.
            </p>
          </div>
          <span className="text-cadet/30 text-sm">&rarr;</span>
        </div>
      </Link>

      {/* ── section 3: seasonal recommendations ── */}
      <SeasonalBanner />

      {/* ── section 3b: pack upsell for unowned packs ── */}
      <PackUpsellSection packs={unownedPacks} />

      {/* ── section 4: recent reflections ── */}
      <div className="border-t border-cadet/10 pt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-cadet">recent reflections</h2>
          <div className="flex items-center gap-3">
            <Link
              href="/playbook/reflections"
              className="text-xs text-cadet/40 hover:text-cadet/60 transition-colors"
            >
              see all &rarr;
            </Link>
            <Link
              href="/reflections/new"
              className="rounded-lg px-4 py-2 text-xs font-medium text-white transition-all hover:opacity-90"
              style={{ backgroundColor: "var(--wv-redwood)" }}
            >
              log a reflection
            </Link>
          </div>
        </div>

        {recentRuns.length === 0 ? (
          <p className="text-sm text-cadet/30 py-4 text-center">
            no reflections yet. after you try a playdate,{" "}
            <Link
              href="/reflections/new"
              className="text-redwood hover:text-sienna transition-colors"
            >
              log it here
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-2">
            {recentRuns.map((run: RunRow) => (
              <div
                key={run.id}
                className="flex items-center justify-between rounded-lg border border-cadet/5 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium text-cadet">
                    {run.playdate_title ?? run.title}
                  </span>
                  {run.run_date && (
                    <span className="text-cadet/40 ml-2">
                      {new Date(run.run_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>
                {run.trace_evidence?.length > 0 && (
                  <span className="text-[10px] text-cadet/30">
                    {run.trace_evidence.length} evidence
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

/* ── helper components ── */

function Pill({
  label,
  accent,
}: {
  label: string;
  accent?: "champagne" | "sienna" | "redwood";
}) {
  const colors = {
    champagne: "bg-champagne/20 text-cadet/60",
    sienna: "bg-sienna/10 text-sienna/70",
    redwood: "bg-redwood/10 text-redwood/70",
  };
  const cls = accent ? colors[accent] : "bg-cadet/5 text-cadet/50";

  return (
    <span className={`inline-block rounded-full px-2.5 py-1 font-medium ${cls}`}>
      {label}
    </span>
  );
}
