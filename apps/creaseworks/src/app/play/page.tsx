/**
 * /play — the "fold" tab: shape insight into experiment.
 *
 * Merged view combining:
 *   1. Playbook (collections with progress) — for authenticated users
 *   2. Sampler (playdate browser) — for everyone
 *
 * Authenticated users see their collections on top ("what are you working on?")
 * followed by the full sampler below ("what else is there?").
 * Unauthenticated users see the sampler only.
 *
 * Part of the winded.vertigo creative cycle: find → fold → unfold → find again
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getSession } from "@/lib/auth-helpers";
import {
  getCollectionsWithProgress,
  getUserProgressSummary,
  getNextSuggestion,
  recomputeUserProgress,
} from "@/lib/queries/collections";
import { getTeaserPlaydates } from "@/lib/queries/playdates";
import { batchGetPackInfoForPlaydates } from "@/lib/queries/packs";
import { getRunsForUser } from "@/lib/queries/runs";
import { getUserOnboardingStatus } from "@/lib/queries/users";
import CollectionCard from "@/components/ui/collection-card";
import PlaybookSearch from "@/components/playbook-search";
import { PlaydateCard } from "@/components/ui/playdate-card";
import StartHereCard from "@/components/start-here-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "play",
  description:
    "explore collections and playdates — shape insight into creative experiments with everyday materials.",
};

export default async function PlayPage() {
  const session = await getSession();

  return (
    <main className="min-h-screen px-6 pt-16 pb-24 sm:pb-16 max-w-5xl mx-auto">
      {/* ── page header ── */}
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          fold
        </h1>
        <p className="text-cadet/60 max-w-lg text-sm">
          shape insight into experiment — explore collections and playdates
          to find your next creative moment.
        </p>
      </header>

      {/* ── playbook section (authenticated users only) ── */}
      {session && (
        <Suspense fallback={<PlaybookSkeleton />}>
          <PlaybookSection userId={session.userId} />
        </Suspense>
      )}

      {/* ── sampler section (everyone) ── */}
      <Suspense fallback={<SamplerSkeleton />}>
        <SamplerSection />
      </Suspense>
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────
 * PlaybookSection — collections with progress (authed only)
 * Each section is an independent async server component that
 * streams its data fetch in parallel.
 * ───────────────────────────────────────────────────────────── */

async function PlaybookSection({ userId }: { userId: string }) {
  await recomputeUserProgress(userId);

  const [collections, summary, suggestion] = await Promise.all([
    getCollectionsWithProgress(userId),
    getUserProgressSummary(userId),
    getNextSuggestion(userId),
  ]);

  const hasProgress = summary.total_tried > 0;

  if (collections.length === 0) return null;

  return (
    <section className="mb-12">
      <h2 className="text-lg font-semibold text-cadet mb-1">
        your collections
      </h2>
      <p className="text-xs text-cadet/40 mb-4">
        playbook progress — pick up where you left off.
      </p>

      {/* progress pills */}
      {hasProgress && (
        <div className="flex flex-wrap gap-2 text-xs mb-4">
          <Pill label={`${summary.total_tried} tried`} />
          {summary.total_found > 0 && (
            <Pill label={`${summary.total_found} found`} accent="champagne" />
          )}
          {summary.total_folded > 0 && (
            <Pill label={`${summary.total_folded} folded`} accent="sienna" />
          )}
          {summary.total_found_again > 0 && (
            <Pill label={`${summary.total_found_again} found again`} accent="redwood" />
          )}
        </div>
      )}

      {/* suggestion nudge */}
      {suggestion && (
        <Link
          href={`/playbook/${suggestion.collection.slug}`}
          className="block mb-5 rounded-lg bg-champagne/15 px-4 py-3 text-sm text-cadet/60 hover:bg-champagne/25 transition-colors"
        >
          {suggestion.reason} — try{" "}
          <span className="font-medium text-cadet">
            {suggestion.collection.icon_emoji} {suggestion.collection.title}
          </span>{" "}
          &rarr;
        </Link>
      )}

      {/* collections grid */}
      <PlaybookSearch collections={collections} hasProgress={hasProgress} />

      {/* portfolio link */}
      <Link
        href="/playbook/portfolio"
        className="block mt-6 rounded-xl border px-5 py-4 hover:shadow-warm transition-shadow"
        style={{
          borderColor: "rgba(203, 120, 88, 0.12)",
          backgroundColor: "rgba(203, 120, 88, 0.03)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-cadet">your portfolio</h3>
            <p className="text-xs text-cadet/40 mt-0.5">
              photos, quotes, and observations from your reflections.
            </p>
          </div>
          <span className="text-cadet/30 text-sm">&rarr;</span>
        </div>
      </Link>

      {/* visual separator */}
      <div className="border-t border-cadet/8 mt-10 mb-2" />
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * SamplerSection — playdate browser (everyone)
 * ───────────────────────────────────────────────────────────── */

interface TeaserPlaydate {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  release_channel: string | null;
  status: string;
  primary_function: string | null;
  arc_emphasis: string[];
  context_tags: string[];
  friction_dial: number | null;
  start_in_120s: boolean;
  has_find_again?: boolean;
  run_count: number;
  tinkering_tier: string | null;
  cover_url?: string | null;
  gallery_visible_fields?: string[] | null;
}

async function SamplerSection() {
  const session = await getSession();
  const playdates = await getTeaserPlaydates();

  const packInfoMap = await batchGetPackInfoForPlaydates(
    playdates.map((p: TeaserPlaydate) => p.id),
  );

  // Check if signed-in user needs onboarding
  const onboarding = session
    ? await getUserOnboardingStatus(session.userId)
    : null;
  const needsOnboarding = session && onboarding && !onboarding.onboarding_completed;

  // Check if user has any runs logged
  let userRuns: unknown[] = [];
  if (session && !needsOnboarding) {
    userRuns = await getRunsForUser(session, 1, 0);
  }
  const hasRuns = userRuns.length > 0;

  return (
    <section>
      <h2 className="text-lg font-semibold text-cadet mb-1">
        playdates
      </h2>
      <p className="text-xs text-cadet/40 mb-6">
        hands-on activities using everyday materials — grab a pack to unlock the full guide.
      </p>

      {/* onboarding nudge */}
      {needsOnboarding && (
        <Link
          href="/onboarding"
          className="block mb-8 rounded-xl border px-5 py-4 hover:shadow-md transition-all"
          style={{
            borderColor: "rgba(203, 120, 88, 0.3)",
            backgroundColor: "rgba(203, 120, 88, 0.06)",
          }}
        >
          <p className="text-2xs font-semibold tracking-wide text-sienna mb-1">
            personalise your experience
          </p>
          <p className="text-base font-semibold text-cadet">
            tell us about your play style
          </p>
          <p className="text-sm text-cadet/50 mt-0.5">
            3 quick questions so we can recommend the perfect first playdate &rarr;
          </p>
        </Link>
      )}

      {/* start-here card for new users */}
      {!needsOnboarding && session && !hasRuns && playdates.length > 0 && (() => {
        const prefs = onboarding?.play_preferences;
        const energyPref = prefs?.energy;
        const contextPref = prefs?.contexts as string[] | undefined;

        const pick = playdates.find((p: TeaserPlaydate) => {
          if (energyPref === "chill" && (p.friction_dial === null || p.friction_dial > 2)) return false;
          if (energyPref === "active" && (p.friction_dial === null || p.friction_dial < 4)) return false;
          if (contextPref?.length && p.context_tags?.length) {
            const tags = p.context_tags as string[];
            if (!contextPref.some((c: string) => tags.includes(c))) return false;
          }
          return p.start_in_120s;
        }) ?? playdates.find(
          (p: TeaserPlaydate) => p.friction_dial !== null && p.friction_dial <= 2 && p.start_in_120s,
        ) ?? playdates[0];

        return (
          <StartHereCard
            slug={pick.slug}
            title={pick.title}
            headline={pick.headline}
            primaryFunction={pick.primary_function}
            arcEmphasis={pick.arc_emphasis ?? []}
            contextTags={pick.context_tags ?? []}
            frictionDial={pick.friction_dial}
            startIn120s={pick.start_in_120s}
            hasFindAgain={pick.has_find_again}
            runCount={pick.run_count}
            coverUrl={pick.cover_url}
            visibleFields={pick.gallery_visible_fields}
          />
        );
      })()}

      {/* playdate grid */}
      {playdates.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-3xl mb-3" aria-hidden>🎨</p>
          <p className="text-cadet/50 text-sm">
            new playdates are on the way — check back soon!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 wv-stagger">
          {playdates.map((p: TeaserPlaydate) => {
            const pi = packInfoMap.get(p.id);
            return (
              <PlaydateCard
                key={p.id}
                slug={p.slug}
                title={p.title}
                headline={p.headline}
                primaryFunction={p.primary_function}
                arcEmphasis={p.arc_emphasis ?? []}
                contextTags={p.context_tags ?? []}
                frictionDial={p.friction_dial}
                startIn120s={p.start_in_120s}
                hasFindAgain={p.has_find_again}
                runCount={p.run_count}
                packInfo={pi ? { packSlug: pi.packSlug, packTitle: pi.packTitle } : null}
                tinkeringTier={p.tinkering_tier}
                coverUrl={p.cover_url}
                visibleFields={p.gallery_visible_fields}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ── loading skeletons ── */

function PlaybookSkeleton() {
  return (
    <section className="mb-12 animate-pulse">
      <div className="h-5 w-40 bg-cadet/5 rounded mb-4" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-cadet/5 rounded-xl" />
        ))}
      </div>
    </section>
  );
}

function SamplerSkeleton() {
  return (
    <section className="animate-pulse">
      <div className="h-5 w-32 bg-cadet/5 rounded mb-6" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-48 bg-cadet/5 rounded-xl" />
        ))}
      </div>
    </section>
  );
}

/* ── helpers ── */

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
