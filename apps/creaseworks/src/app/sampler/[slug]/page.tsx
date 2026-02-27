import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  getTeaserPlaydateBySlug,
  getTeaserMaterialsForPlaydate,
  getCollectivePlaydateBySlug,
} from "@/lib/queries/playdates";
import { getFirstVisiblePackForPlaydate } from "@/lib/queries/packs";
import { checkEntitlement } from "@/lib/queries/entitlements";
import { getSession } from "@/lib/auth-helpers";
import EntitledPlaydateView from "@/components/ui/entitled-playdate-view";
import QuickLogButton from "@/components/ui/quick-log-button";
import { MaterialIllustration } from "@/components/material-illustration";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ slug: string }>;
}

interface Material {
  id: string;
  title: string;
  form_primary: string;
  functions: string[] | null;
  context_tags: string[] | null;
}

export default async function PlaydateTeaserPage({ params }: Props) {
  const { slug } = await params;
  const session = await getSession();

  // ââ Internal user â always show full collective view ââ
  if (session?.isInternal) {
    const fullPlaydate = await getCollectivePlaydateBySlug(slug);
    if (!fullPlaydate) return notFound();

    const [materials, pack] = await Promise.all([
      getTeaserMaterialsForPlaydate(fullPlaydate.id),
      getFirstVisiblePackForPlaydate(fullPlaydate.id),
    ]);

    // If the playdate IS in a pack, redirect to the pack view
    if (pack) {
      redirect(`/packs/${pack.slug}/playdates/${slug}?from=sampler`);
    }

    return (
      <main className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
        <Link
          href="/sampler"
          className="text-sm text-cadet/50 hover:text-cadet mb-6 inline-block"
        >
          &larr; back to playdates
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight mb-4">
          {fullPlaydate.title}
        </h1>

        <EntitledPlaydateView
          playdate={fullPlaydate}
          materials={materials}
          packSlug={null}
        />
      </main>
    );
  }

  // ââ Everyone else â sampler teaser path ââ
  const playdate = await getTeaserPlaydateBySlug(slug);
  if (!playdate) return notFound();

  const [materials, pack] = await Promise.all([
    getTeaserMaterialsForPlaydate(playdate.id),
    getFirstVisiblePackForPlaydate(playdate.id),
  ]);

  // Entitled user WITH a pack â redirect to the pack's playdate page
  if (session && pack) {
    const isEntitled = session.orgId
      ? await checkEntitlement(session.orgId, pack.id)
      : false;
    if (isEntitled) {
      redirect(`/packs/${pack.slug}/playdates/${slug}?from=sampler`);
    }
  }

  // ââ Everyone else â sampler teaser ââ
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
        {playdate.title}
      </h1>

      {playdate.headline && (
        <p className="text-lg text-cadet/60 mb-6">{playdate.headline}</p>
      )}

      {/* the big idea â narrative hook */}
      {playdate.rails_sentence && (
        <section className="rounded-xl border border-cadet/10 bg-white p-6 mb-8">
          <h2 className="text-sm font-semibold text-cadet/80 mb-2">
            the big idea
          </h2>
          <p className="text-sm text-cadet/80 italic">
            {playdate.rails_sentence}
          </p>
        </section>
      )}

      {/* at a glance â quick parent-readable summary */}
      <section className="rounded-xl border border-cadet/10 bg-champagne/30 p-6 mb-8">
        <h2 className="text-sm font-semibold text-cadet/80 mb-4">
          at a glance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {playdate.primary_function && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">🎯</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">what&apos;s it about</p>
                <p className="text-cadet/80">{playdate.primary_function}</p>
              </div>
            </div>
          )}
          {playdate.friction_dial !== null && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">🎚️</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">energy level</p>
                <p className="text-cadet/80">
                  {playdate.friction_dial <= 2
                    ? `chill (${playdate.friction_dial}/5)`
                    : playdate.friction_dial <= 3
                      ? `medium (${playdate.friction_dial}/5)`
                      : `high energy (${playdate.friction_dial}/5)`}
                </p>
              </div>
            </div>
          )}
          {playdate.start_in_120s && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">⚡</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">setup time</p>
                <p className="text-cadet/80">ready in under 2 minutes</p>
              </div>
            </div>
          )}
          {(playdate.arc_emphasis as string[])?.length > 0 && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">🌱</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">what kids practise</p>
                <p className="text-cadet/80">{(playdate.arc_emphasis as string[]).join(", ")}</p>
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
            {materials.map((m: Material) => (
              <li
                key={m.id}
                className="flex items-center gap-2.5 text-sm"
              >
                <MaterialIllustration formPrimary={m.form_primary} size={24} className="opacity-80" />
                <span className="inline-block rounded-full bg-cadet/5 px-2.5 py-0.5 text-xs font-medium text-cadet/70">
                  {m.form_primary}
                </span>
                <span className="text-cadet/80">{m.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* locked content teaser â FOMO section */}
      <section className="rounded-xl border border-sienna/20 bg-gradient-to-b from-champagne/20 to-champagne/5 p-6 mb-8">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-lg leading-none mt-0.5">🔒</span>
          <div>
            <h2 className="text-sm font-semibold text-cadet/80 mb-1">
              full facilitation guide
            </h2>
            <p className="text-sm text-cadet/60">
              the full playdate includes step-by-step facilitation
              with three phases â find, fold, and unfold â plus
              material swap ideas and timing tips.
            </p>
          </div>
        </div>

        {/* teaser list of what's inside */}
        <div className="ml-8 space-y-2 text-sm text-cadet/50 mb-5">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-redwood/40" />
            <span>find â how to set up and introduce the activity</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sienna/40" />
            <span>fold â the core hands-on exploration</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cadet/30" />
            <span>unfold â reflection and what to notice</span>
          </div>
          {playdate.has_find_again && (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-redwood/60" />
              <span>find again â a prompt to spot the idea in everyday life</span>
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

      {/* quick-log + full reflection CTAs â authenticated users only */}
      {session && (
        <section className="flex flex-wrap items-center gap-3 mb-8">
          <QuickLogButton
            playdateId={playdate.id}
            playdateTitle={playdate.title}
            playdateSlug={slug}
          />
          <Link
            href={`/reflections/new?playdate=${slug}`}
            className="inline-block rounded-lg bg-redwood px-5 py-2.5 text-sm text-white font-medium hover:bg-sienna transition-colors"
          >
            log a reflection
          </Link>
        </section>
      )}
    </main>
  );
}
