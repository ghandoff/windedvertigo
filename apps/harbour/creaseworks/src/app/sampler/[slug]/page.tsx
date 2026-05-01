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
import Image from "next/image";
import EntitledPlaydateView from "@/components/ui/entitled-playdate-view";
import QuickLogButton from "@/components/ui/quick-log-button";
import SafeHtml from "@/components/ui/safe-html";
import { MaterialIllustration } from "@/components/material-illustration";
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PlaydateTeaserPage({ params }: Props) {
  const { slug } = await params;
  const session = await getSession();

  // ── Internal user → always show full collective view ──
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

        {fullPlaydate.cover_url && (
          <div className="relative w-full h-[240px] sm:h-[320px] rounded-xl overflow-hidden bg-cadet/5 mb-6">
            <Image
              src={fullPlaydate.cover_url}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
        )}

        <h1 className="text-3xl font-semibold tracking-tight font-serif mb-4">
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

  // ── Everyone else → sampler teaser path ──
  const playdate = await getTeaserPlaydateBySlug(slug);
  if (!playdate) return notFound();

  const [materials, pack] = await Promise.all([
    getTeaserMaterialsForPlaydate(playdate.id),
    getFirstVisiblePackForPlaydate(playdate.id),
  ]);

  // Entitled user WITH a pack → redirect to the pack's playdate page
  if (session && pack) {
    const isEntitled = await checkEntitlement(session.orgId, pack.id, session.userId);
    if (isEntitled) {
      redirect(`/packs/${pack.slug}/playdates/${slug}?from=sampler`);
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

      {playdate.cover_url && (
        <div className="relative w-full h-[240px] sm:h-[320px] rounded-xl overflow-hidden bg-cadet/5 mb-6">
          <Image
            src={playdate.cover_url}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>
      )}

      <h1 className="text-3xl font-semibold tracking-tight font-serif mb-2">
        {playdate.title}
      </h1>

      {playdate.headline && (
        <p className="text-lg text-cadet/60 mb-8">{playdate.headline}</p>
      )}

      {/* ── at a glance ── */}
      <section className="rounded-xl border border-cadet/10 bg-cream/30 p-6 mb-8">
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

      {/* ── the big idea ── */}
      {playdate.rails_sentence && (
        <section className="rounded-xl p-6 mb-8" style={{ background: "var(--wv-cream)", border: "1.5px solid rgba(39, 50, 72, 0.08)" }}>
          <h2 className="text-sm font-semibold text-cadet/80 mb-2">
            the big idea
          </h2>
          <p className="text-sm text-cadet/80 italic">
            {playdate.rails_sentence}
          </p>
        </section>
      )}

      {/* ── what you'll need ── */}
      {materials.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-cadet/80 mb-3">
            what you&apos;ll need
          </h2>
          <ul className="space-y-2">
            {materials.map((m: { id: string; title: string; form_primary: string; }) => (
              <li key={m.id} className="flex items-center gap-2.5 text-sm">
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

      {/* ── how to play: find → fold → unfold ── */}
      <section className="space-y-4 mb-8">
        <h2 className="text-sm font-semibold text-cadet/80">
          how to play
        </h2>

        {playdate.find && (
          <div className="rounded-xl p-5" style={{ background: "var(--wv-cream)", border: "1.5px solid rgba(39, 50, 72, 0.08)" }}>
            <h3 className="text-xs font-bold text-redwood tracking-wider mb-1">
              find
            </h3>
            <p className="text-[11px] text-cadet/40 mb-2">
              gather materials and set the stage
            </p>
            <SafeHtml
              html={playdate.find_html}
              fallback={playdate.find}
              className="text-sm text-cadet/80 whitespace-pre-line"
            />
          </div>
        )}

        {playdate.fold && (
          <div className="rounded-xl p-5" style={{ background: "var(--wv-cream)", border: "1.5px solid rgba(39, 50, 72, 0.08)" }}>
            <h3 className="text-xs font-bold text-sienna tracking-wider mb-1">
              fold
            </h3>
            <p className="text-[11px] text-cadet/40 mb-2">
              the hands-on exploration
            </p>
            <SafeHtml
              html={playdate.fold_html}
              fallback={playdate.fold}
              className="text-sm text-cadet/80 whitespace-pre-line"
            />
          </div>
        )}

        {playdate.unfold && (
          <div className="rounded-xl p-5" style={{ background: "var(--wv-cream)", border: "1.5px solid rgba(39, 50, 72, 0.08)" }}>
            <h3 className="text-xs font-bold text-cadet tracking-wider mb-1">
              unfold
            </h3>
            <p className="text-[11px] text-cadet/40 mb-2">
              reflect on what happened
            </p>
            <SafeHtml
              html={playdate.unfold_html}
              fallback={playdate.unfold}
              className="text-sm text-cadet/80 whitespace-pre-line"
            />
          </div>
        )}
      </section>

      {/* ── find again ── */}
      {playdate.find_again_mode && (
        <section className="rounded-xl border border-redwood/20 bg-redwood/5 p-6 mb-8">
          <h2 className="text-sm font-semibold text-redwood mb-2">
            find again — {playdate.find_again_mode}
          </h2>
          {playdate.find_again_prompt && (
            <SafeHtml
              html={playdate.find_again_prompt_html}
              fallback={playdate.find_again_prompt}
              className="text-sm text-cadet/80 whitespace-pre-line"
            />
          )}
        </section>
      )}

      {/* ── want more? — soft upsell ── */}
      <section className="rounded-xl border border-sienna/20 bg-gradient-to-b from-cream/20 to-cream/5 p-6 mb-8">
        <h2 className="text-sm font-semibold text-cadet/80 mb-1">
          want more?
        </h2>
        <p className="text-sm text-cadet/60 mb-4">
          packs include material swap ideas, substitution notes,
          downloadable PDF guides, and developmental insights
          for every playdate in a collection.
        </p>
        <Link
          href={packHref}
          className="inline-block rounded-lg bg-redwood px-5 py-2.5 text-sm text-white font-medium hover:bg-sienna transition-colors"
        >
          {pack ? `see ${pack.title}` : "see packs"}
        </Link>
      </section>

      {/* quick-log + full reflection CTAs — authenticated users only */}
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
