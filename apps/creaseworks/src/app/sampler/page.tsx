import type { Metadata } from "next";
import { getTeaserPlaydates } from "@/lib/queries/playdates";
import { getSession } from "@/lib/auth-helpers";
import { getUserOnboardingStatus } from "@/lib/queries/users";
import { PlaydateCard } from "@/components/ui/playdate-card";
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

export default async function SamplerPage() {
  const session = await getSession();

  // Everyone sees sampler-channel playdates only.
  // Admins who need the full catalog should use /admin/playdates.
  const playdates = await getTeaserPlaydates();

  // Check if signed-in user needs onboarding
  const onboarding = session
    ? await getUserOnboardingStatus(session.userId)
    : null;
  const needsOnboarding = session && onboarding && !onboarding.onboarding_completed;

  return (
    <main className="min-h-screen px-6 py-16 max-w-5xl mx-auto">
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

        const pick = playdates.find((p: any) => {
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
          (p: any) => p.friction_dial !== null && p.friction_dial <= 2 && p.start_in_120s,
        ) ?? playdates[0];

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
        <p className="text-cadet/40 text-center py-20">
          no playdates here yet. check back soon.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playdates.map((p: any) => (
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
            />
          ))}
        </div>
      )}
    </main>
  );
}
