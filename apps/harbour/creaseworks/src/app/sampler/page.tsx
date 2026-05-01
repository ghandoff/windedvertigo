import type { Metadata } from "next";
import { getTeaserPlaydates } from "@/lib/queries/playdates";
import { getSession } from "@/lib/auth-helpers";
import { getUserOnboardingStatus } from "@/lib/queries/users";
import { batchGetPackInfoForPlaydates } from "@/lib/queries/packs";
import { PlaydateCard } from "@/components/ui/playdate-card";
import Link from "next/link";

export const metadata: Metadata = {
  title: "free playdates",
  description:
    "browse free playdate previews — hands-on activities for kids using everyday materials like cardboard, sticks, and tape. no sign-up needed.",
};

// Force dynamic rendering — session-dependent content (onboarding nudge)
// means this page can't be ISR-cached.
export const dynamic = "force-dynamic";

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

export default async function SamplerPage() {
  const session = await getSession();

  // Everyone sees sampler-channel playdates only.
  // Admins who need the full catalog should use /admin/playdates.
  const playdates = await getTeaserPlaydates();

  const playdateIds = playdates.map((p: TeaserPlaydate) => p.id);

  const packInfoMap = await batchGetPackInfoForPlaydates(playdateIds);

  // Check if signed-in user needs onboarding
  const onboarding = session
    ? await getUserOnboardingStatus(session.userId)
    : null;
  const needsOnboarding = session && onboarding && !onboarding.onboarding_completed;

  return (
    <main className="min-h-screen px-6 pt-16 pb-24 sm:pb-16 max-w-5xl mx-auto">
      <header className="mb-12">
        <Link href="/" className="text-sm text-cadet/50 hover:text-cadet mb-4 inline-block">
          &larr; creaseworks
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight font-serif mb-2">
          playdate sampler
        </h1>
        <p className="text-cadet/60 max-w-lg">
          simple playdates you can try right now — no account needed.
          grab a pack to unlock the full guide, materials list, and find-again prompts.
        </p>
        <Link
          href="/browse"
          className="inline-block mt-3 text-sm text-redwood hover:text-sienna transition-colors"
        >
          browse all playdates &rarr;
        </Link>
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
                arcEmphasis={[]}
                contextTags={p.context_tags ?? []}
                frictionDial={p.friction_dial}
                startIn120s={p.start_in_120s}
                hasFindAgain={p.has_find_again}
                runCount={p.run_count}
                packInfo={pi ? { packSlug: pi.packSlug, packTitle: pi.packTitle } : null}
                coverUrl={p.cover_url}
                visibleFields={["headline", "primaryFunction", "energyLevel", "startIn120s", "findAgain", "runCount", "packInfo"]}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
