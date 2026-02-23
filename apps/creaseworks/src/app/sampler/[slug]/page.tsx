import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getTeaserPatternBySlug,
  getTeaserMaterialsForPattern,
} from "@/lib/queries/patterns";
import { getFirstVisiblePackForPattern } from "@/lib/queries/packs";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PatternTeaserPage({ params }: Props) {
  const { slug } = await params;
  const pattern = await getTeaserPatternBySlug(slug);

  if (!pattern) return notFound();

  const materials = await getTeaserMaterialsForPattern(pattern.id);
  const pack = await getFirstVisiblePackForPattern(pattern.id);

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

      {/* teaser metadata — playful, parent-readable */}
      <section className="rounded-xl border border-cadet/10 bg-champagne/30 p-6 mb-8">
        <h2 className="text-sm font-semibold text-cadet/80 mb-4">
          before you begin
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
          {(pattern.required_forms as string[])?.length > 0 && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">✂️</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">you&apos;ll need to make</p>
                <p className="text-cadet/80">{(pattern.required_forms as string[]).join(", ")}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* teaser materials */}
      {materials.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-cadet/80 mb-3">
            what you'll need
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

      {/* find again teaser — conversion hook */}
      {pattern.has_find_again && (
        <section className="rounded-xl border border-redwood/20 bg-redwood/5 p-6">
          <h2 className="text-sm font-semibold text-redwood mb-2">
            includes find again
          </h2>
          <p className="text-sm text-cadet/70 mb-4">
            after you play, there&apos;s a prompt that helps kids (and you)
            notice the same idea popping up in totally different places.
            find again prompts unlock when you grab the full pack.
          </p>
          <Link
            href={pack ? `/packs/${pack.slug}` : "/packs"}
            className="inline-block rounded-lg bg-redwood px-4 py-2 text-sm text-white font-medium hover:bg-sienna transition-colors"
          >
            {pack ? `get ${pack.title}` : "see packs"}
          </Link>
        </section>
      )}
    </main>
  );
}
