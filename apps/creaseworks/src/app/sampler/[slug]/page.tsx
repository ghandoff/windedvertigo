import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  getTeaserPatternBySlug,
  getTeaserMaterialsForPattern,
  getCollectivePatternBySlug,
  getEntitledPatternBySlug,
} from "@/lib/queries/patterns";
import { getFirstVisiblePackForPattern } from "@/lib/queries/packs";
import { checkEntitlement } from "@/lib/queries/entitlements";
import { getSession } from "@/lib/auth-helpers";
import EntitledPatternView from "@/components/ui/entitled-pattern-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PatternTeaserPage({ params }: Props) {
  const { slug } = await params;
  const pattern = await getTeaserPatternBySlug(slug);

  if (!pattern) return notFound();

  const [materials, pack, session] = await Promise.all([
    getTeaserMaterialsForPattern(pattern.id),
    getFirstVisiblePackForPattern(pattern.id),
    getSession(),
  ]);

  // ── Entitled user WITH a pack → redirect to the pack's pattern page ──
  if (session && pack) {
    const isEntitled =
      session.isInternal ||
      (session.orgId
        ? await checkEntitlement(session.orgId, pack.id)
        : false);
    if (isEntitled) {
      redirect(`/packs/${pack.slug}/patterns/${slug}`);
    }
  }

  // ── Internal user WITHOUT a pack → render full view inline ──
  // Patterns may not be in a visible pack yet (e.g. still being assembled),
  // but admins / collective members should still see the full facilitation view.
  if (session?.isInternal) {
    const fullPattern = await getCollectivePatternBySlug(slug);
    if (fullPattern) {
      return (
        <main className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
          <Link
            href="/sampler"
            className="text-sm text-cadet/50 hover:text-cadet mb-6 inline-block"
          >
            &larr; back to playdates
          </Link>

          <h1 className="text-3xl font-semibold tracking-tight mb-4">
            {fullPattern.title}
          </h1>

          <EntitledPatternView
            pattern={fullPattern}
            materials={materials}
            packSlug={null}
          />
        </main>
      );
    }
  }

  // ── Everyone else → sampler teaser ──
  const packHref = pack ? `/packs/${pack.slug}` : "/packs";

  return (
    <main className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
      <Link
        href="/sampler"
        className="text-sm text-cadet/50 hover:text-cadet mb-6 inline-block"
      >
        &larr; back to playdates
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        {pattern.title}
      </h1>

      {pattern.headline && (
        <p className="text-lg text-cadet/60 mb-6">{pattern.headline}</p>
      )}

      {/* the big idea — narrative hook */}
      {pattern.rails_sentence && (
        <section className="rounded-xl border border-cadet/10 bg-white p-6 mb-8">
          <h2 className="text-sm font-semibold text-cadet/80 mb-2">
            the big idea
          </h2>
          <p className="text-sm text-cadet/80 italic">
            {pattern.rails_sentence}
          </p>
        </section>
      )}

      {/* at a glance — quick parent-readable summary */}
      <section className="rounded-xl border border-cadet/10 bg-champagne/30 p-6 mb-8">
        <h2 className="text-sm font-semibold text-cadet/80 mb-4">
          at a glance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {pattern.primary_function && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">🎯</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">what&apos;s it about</p>
                <p className="text-cadet/80">{pattern.primary_function}</p>
              </div>
            </div>
          )}
          {pattern.friction_dial !== null && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">🎚️</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">energy level</p>
                <p className="text-cadet/80">
                  {pattern.friction_dial <= 2
                    ? `chill (${pattern.friction_dial}/5)`
                    : pattern.friction_dial <= 3
                      ? `medium (${pattern.friction_dial}/5)`
                      : `high energy (${pattern.friction_dial}/5)`}
                </p>
              </div>
            </div>
          )}
          {pattern.start_in_120s && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">⚡</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">setup time</p>
                <p className="text-cadet/80">ready in under 2 minutes</p>
              </div>
            </div>
          )}
          {(pattern.arc_emphasis as string[])?.length > 0 && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">🌱</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">what kids practise</p>
                <p className="text-cadet/80">{(pattern.arc_emphasis as string[]).join(", ")}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* materials preview */}
      {materials.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-cadet/80 mb-3">
            what you&apos;ll need
          </h2>
          <ul className="space-y-2">
            {materials.map((m: any) => (
              <li
                key={m.id}
                className="flex items-center gap-2 text-sm"
              >
                <span className="inline-block rounded-full bg-cadet/5 px-2.5 py-0.5 text-xs font-medium">
                  {m.form_primary}
                </span>
                <span>{m.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* locked content teaser — FOMO section */}
      <section className="rounded-xl border border-sienna/20 bg-gradient-to-b from-champagne/20 to-champagne/5 p-6 mb-8">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-lg leading-none mt-0.5">🔒</span>
          <div>
            <h2 className="text-sm font-semibold text-cadet/80 mb-1">
              full facilitation guide
            </h2>
            <p className="text-sm text-cadet/60">
              the full playdate includes step-by-step facilitation
              with three phases — find, fold, and unfold — plus
              material swap ideas and timing tips.
            </p>
          </div>
        </div>

        {/* teaser list of what's inside */}
        <div className="ml-8 space-y-2 text-sm text-cadet/50 mb-5">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-redwood/40" />
            <span>find — how to set up and introduce the activity</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sienna/40" />
            <span>fold — the core hands-on exploration</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cadet/30" />
            <span>unfold — reflection and what to notice</span>
          </div>
          {pattern.has_find_again && (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-redwood/60" />
              <span>find again — a prompt to spot the idea in everyday life</span>
            </div>
          )}
        </div>

        <Link
          href={packHref}
          className="inline-block rounded-lg bg-redwood px-5 py-2.5 text-sm text-white font-medium hover:bg-sienna transition-colors"
        >
          {pack ? `unlock with ${pack.title}` : "see packs"}
        </Link>
      </section>
    </main>
  );
}
