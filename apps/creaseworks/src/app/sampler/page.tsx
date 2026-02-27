import type { Metadata } from "next";
import { getTeaserPlaydates } from "@/lib/queries/playdates";
import { getSession } from "@/lib/auth-helpers";
import { getUserOnboardingStatus } from "@/lib/queries/users";
import { getRunsForUser } from "@/lib/queries/runs";
import { batchGetPackInfoForPlaydates } from "@/lib/queries/packs";
import { PlaydateCard } from "@/components/ui/playdate-card";
import StartHereCard from "@/components/start-here-card";
import Link from "next/link";

export const metadata: Metadata = {
  title: "free playdates",
  description:
    "browse free playdate previews — hands-on activities for kids using everyday materials like cardboard, sticks, and tape. no sign-up needed.",
};

// Force dynamic rendering — the DB connection isn't available at build time.
// On Vercel with ISR this will cache for 1 hour after first request.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

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
}

export default async function SamplerPage() {
  const session = await getSession();

  // Everyone sees sampler-channel playdates only.
  // Admins who need the full catalog should use /admin/playdates.
  const playdates = await getTeaserPlaydates();

  // Batch-fetch pack info for FOMO badges on sampler cards
  const packInfoMap = await batchGetPackInfoForPlaydates(
    playdates.map((p: TeaserPlaydate) => p.id),
  );

  // Check if signed-in user needs onboarding
  const onboarding = session
    ? await getUserOnboardingStatus(session.userId)
    : null;
  const needsOnboarding = session && onboarding && !onboarding.onboarding_completed;

  // Check if user has any runs logged
  let userRuns = [];
  if (session && !needsOnboarding) {
    userRuns = await getRunsForUser(session, 1, 0);
  }
  const hasRuns = userRuns.length > 0;

  return (
    <main className="min-h-screen px-6 pt-16 pb-24 sm:pb-16 max-w-5xl mx-auto">
      <header className="mb-12">
        <Link href="/" className="text-sm text-cadet/50 hover:text-cadet mb-4 inline-block">
          &larr; creaseworks
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          playdate sampler
        </h1>
        <p className="text-cadet/60 max-w-lg">
          simple playdates you can try right now — no account needed.
          grab a pack to unlock the full guide, materials list, and find-again prompts.
        </p>
      </header>

      {/* onboarding nudge for signed-in users who haven't completed the wizard */}
      {needsOnboarding && (
        <Link
          href="/onboarding"
          className="block mb-8 rounded-xl border px-5 py-4 hover:shadow-md transition-all"
          style={{
            borderColor: "rgba(203, 120, 88, 0.3)",
            backgroundColor: "rgba(203, 120, 88, 0.06)",
          }}
        >
          <p className="text-[10px] font-semibold tracking-wide uppercase text-sienna mb-1">
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

      {/* start here — recommend a low-friction quick-start playdate */}
      {!needsOnboarding && playdates.length > 0 && (() => {
        // Use preferences to pick a better match if available
        const prefs = onboarding?.play_preferences;
        const energyPref = prefs?.energy;
        const contextPref = prefs?.contexts as string[] | undefined;

        const pick = playdates.find((p: TeaserPlaydate) => {
          // Match energy preference
          if (energyPref === "chill" && (p.friction_dial === null || p.friction_dial > 2)) return false;
          if (energyPref === "active" && (p.friction_dial === null || p.friction_dial < 4)) return false;
          // Match context preference if set
          if (contextPref?.length && p.context_tags?.length) {
            const tags = p.context_tags as string[];
            if (!contextPref.some((c: string) => tags.includes(c))) return false;
          }
          return p.start_in_120s;
        }) ?? playdates.find(
          (p: TeaserPlaydate) => p.friction_dial !== null && p.friction_dial <= 2 && p.start_in_120s,
        ) ?? playdates[0];

        // Show "start here" card for logged-in users with no runs
        if (session && !hasRuns) {
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
            />
          );
        }

        // Otherwise show the standard recommendation link
        return (
          <Link
            href={`/sampler/${pick.slug}`}
            className="block mb-8 rounded-xl border px-5 py-4 hover:shadow-md transition-all"
            style={{
              borderColor: "rgba(228, 196, 137, 0.3)",
              backgroundColor: "rgba(228, 196, 137, 0.08)",
            }}
          >
            <p className="text-[10px] font-semibold tracking-wide uppercase text-champagne mb-1">
              {prefs ? "recommended for you" : "new here? start with this one"}
            </p>
            <p className="text-base font-semibold text-cadet">{pick.title}</p>
            {pick.headline && (
              <p className="text-sm text-cadet/50 mt-0.5">{pick.headline}</p>
            )}
            <p className="text-xs text-cadet/40 mt-2">
              🌿 chill &middot; ready in 2 min &middot; no account needed &rarr;
            </p>
          </Link>
        );
      })()}

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
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
