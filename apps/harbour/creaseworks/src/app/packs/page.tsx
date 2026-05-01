import type { Metadata } from "next";
import Link from "next/link";
import PackCard from "@/components/ui/pack-card";
import PackFinder from "@/components/pack-finder";
import { getVisiblePacks, getAllPacks } from "@/lib/queries/packs";
import { getSession } from "@/lib/auth-helpers";
import { getCopyForPage } from "@/lib/queries/site-copy";
import { getConfigGroup, parseMetadata } from "@/lib/queries/app-config";

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
  const [packs, c, situationConfig] = await Promise.all([
    isCollective ? getAllPacks() : getVisiblePacks(),
    getCopyForPage("packs"),
    getConfigGroup("pack-finder"),
  ]);

  const situations = situationConfig.length > 0
    ? situationConfig.map((i) => {
        const m = parseMetadata<{ value: string; detail: string; slug: string; season?: string }>(i);
        return { value: m.value, label: i.name, detail: m.detail, slug: m.slug, season: m.season };
      })
    : undefined;

  return (
    <main className="min-h-screen px-6 pt-16 pb-24 sm:pb-16 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-3xl font-semibold tracking-tight font-serif">{c["packs.headline"]?.copy ?? "packs"}</h1>
        {isCollective && (
          <span className="text-2xs font-semibold tracking-wide px-2 py-0.5 rounded-full bg-cadet/8 text-champagne">
            collective view
          </span>
        )}
      </div>
      <p className="text-cadet/60 mb-6">
        {c["packs.description"]?.copy ?? "each pack is a bundle of playdates. buy once, keep forever."}
      </p>

      {/* value proposition */}
      <div
        className="rounded-xl border p-5 mb-4 grid gap-4 sm:grid-cols-5"
        style={{ borderColor: "rgba(39, 50, 72, 0.08)", backgroundColor: "var(--wv-cream)" }}
      >
        {[
          c["packs.features.1"]?.copy ?? "step-by-step guides — clear three-part instructions",
          c["packs.features.2"]?.copy ?? "materials + swaps — use what you already have",
          c["packs.features.3"]?.copy ?? "find again prompts — keep noticing after play",
          c["packs.features.4"]?.copy ?? "printable PDF cards — for the fridge or your bag",
          c["packs.features.5"]?.copy ?? "reflection prompts — capture evidence of learning",
        ].map((text) => {
          const [label, ...rest] = text.split(" — ");
          const detail = rest.join(" — ");
          return (
            <div key={label} className="text-center sm:text-left">
              <p className="text-xs font-semibold" style={{ color: "var(--wv-cadet)" }}>
                {label}
              </p>
              {detail && (
                <p className="text-xs mt-0.5" style={{ color: "var(--wv-cadet)", opacity: 0.45 }}>
                  {detail}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* guided pack finder */}
      <PackFinder
        packs={packs.map((p: Pack) => ({
          slug: p.slug,
          title: p.title,
          description: p.description,
          playdate_count: p.playdate_count,
          price_cents: p.price_cents,
          currency: p.currency,
          family_count: p.family_count,
        }))}
        situations={situations}
      />

      <p className="text-xs text-cadet/40 mb-8">
        {c["packs.nudge.prefix"]?.copy ?? "not sure yet?"}{" "}
        <Link href="/sampler" className="text-redwood hover:text-sienna transition-colors">
          {c["packs.nudge.sampler"]?.copy ?? "try free playdates first"}
        </Link>
        {" "}or{" "}
        <Link href="/matcher" className="text-redwood hover:text-sienna transition-colors">
          {c["packs.nudge.matcher"]?.copy ?? "use the matcher"}
        </Link>
        {" "}{c["packs.nudge.suffix"]?.copy ?? "to see what fits."}
      </p>

      {packs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-cadet/40 text-sm">
            {c["packs.empty-state"]?.copy ?? "no packs available yet — we\u2019re putting the finishing touches on something good."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
            <Link
              href="/sampler"
              className="text-sm text-redwood hover:text-sienna transition-colors"
            >
              {c["packs.empty.sampler-cta"]?.copy ?? "browse free playdates"} &rarr;
            </Link>
            <Link
              href="/matcher"
              className="text-sm text-redwood hover:text-sienna transition-colors"
            >
              {c["packs.empty.matcher-cta"]?.copy ?? "try the matcher"} &rarr;
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 wv-stagger">
          {packs.map((pack: Pack) => (
            <div key={pack.id} className="relative">
              {isCollective && pack.visible === false && (
                <span className="absolute top-3 right-3 z-10 text-2xs font-semibold tracking-wide px-2 py-0.5 rounded-full bg-cadet/40 text-white/70">
                  hidden
                </span>
              )}
              {isCollective && pack.status !== "ready" && (
                <span className="absolute top-3 left-3 z-10 text-2xs font-semibold tracking-wide px-2 py-0.5 rounded-full bg-sienna/80 text-white">
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
