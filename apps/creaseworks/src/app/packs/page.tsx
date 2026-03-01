import type { Metadata } from "next";
import Link from "next/link";
import PackCard from "@/components/ui/pack-card";
import PackFinder from "@/components/pack-finder";
import { getVisiblePacks, getAllPacks } from "@/lib/queries/packs";
import { getSession } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "packs",
  description:
    "browse playdate packs — themed bundles of creative activities for families, teachers, and teams.",
  openGraph: {
    title: "packs",
    description:
      "browse playdate packs — themed bundles of creative activities for families, teachers, and teams.",
  },
};

interface Pack {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  price_cents: number | null;
  currency: string;
  visible?: boolean;
  status?: string;
  playdate_count: number;
  cover_url?: string | null;
  family_count?: number;
}

export default async function PacksCataloguePage() {
  const session = await getSession();
  const isCollective = session?.isInternal ?? false;

  // Collective sees all packs (including non-visible and drafts)
  const packs = isCollective ? await getAllPacks() : await getVisiblePacks();

  return (
    <main className="min-h-screen px-6 pt-16 pb-24 sm:pb-16 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-3xl font-semibold tracking-tight">packs</h1>
        {isCollective && (
          <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-champagne/20 text-champagne">
            collective view
          </span>
        )}
      </div>
      <p className="text-cadet/60 mb-6">
        each pack is a bundle of playdates. buy once, keep forever.
      </p>

      {/* value proposition */}
      <div
        className="rounded-xl border p-5 mb-4 grid gap-4 sm:grid-cols-5"
        style={{ borderColor: "rgba(39, 50, 72, 0.1)", backgroundColor: "var(--wv-white)" }}
      >
        {[
          { label: "step-by-step guides", detail: "clear three-part instructions" },
          { label: "materials + swaps", detail: "use what you already have" },
          { label: "find again prompts", detail: "keep noticing after play" },
          { label: "printable PDF cards", detail: "for the fridge or your bag" },
          { label: "reflection prompts", detail: "capture evidence of learning" },
        ].map((item) => (
          <div key={item.label} className="text-center sm:text-left">
            <p className="text-xs font-semibold" style={{ color: "var(--wv-cadet)" }}>
              {item.label}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--wv-cadet)", opacity: 0.45 }}>
              {item.detail}
            </p>
          </div>
        ))}
      </div>

      {/* guided pack finder */}
      <PackFinder packs={packs.map((p: Pack) => ({
        slug: p.slug,
        title: p.title,
        description: p.description,
        playdate_count: p.playdate_count,
        price_cents: p.price_cents,
        currency: p.currency,
        family_count: p.family_count,
      }))} />

      <p className="text-xs text-cadet/40 mb-8">
        not sure yet?{" "}
        <Link href="/sampler" className="text-redwood hover:text-sienna transition-colors">
          try free playdates first
        </Link>
        {" "}or{" "}
        <Link href="/matcher" className="text-redwood hover:text-sienna transition-colors">
          use the matcher
        </Link>
        {" "}to see what fits.
      </p>

      {packs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-cadet/40 text-sm">
            no packs available yet — we&rsquo;re putting the finishing touches on something good.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
            <Link
              href="/sampler"
              className="text-sm text-redwood hover:text-sienna transition-colors"
            >
              browse free playdates &rarr;
            </Link>
            <Link
              href="/matcher"
              className="text-sm text-redwood hover:text-sienna transition-colors"
            >
              try the matcher &rarr;
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 wv-stagger">
          {packs.map((pack: Pack) => (
            <div key={pack.id} className="relative">
              {isCollective && pack.visible === false && (
                <span className="absolute top-3 right-3 z-10 text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-cadet/40 text-white/70">
                  hidden
                </span>
              )}
              {isCollective && pack.status !== "ready" && (
                <span className="absolute top-3 left-3 z-10 text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-sienna/80 text-white">
                  draft
                </span>
              )}
              <PackCard pack={pack} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
