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
        &larr; back to ideas
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        {pattern.title}
      </h1>

      {pattern.headline && (
        <p className="text-lg text-cadet/60 mb-6">{pattern.headline}</p>
      )}

      {/* teaser metadata */}
      <section className="rounded-xl border border-cadet/10 bg-champagne/30 p-6 mb-8">
        <h2 className="text-sm font-semibold text-cadet/80 mb-3">
          at a glance
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {pattern.primary_function && (
            <>
              <dt className="text-cadet/50">function</dt>
              <dd>{pattern.primary_function}</dd>
            </>
          )}
          {pattern.friction_dial !== null && (
            <>
              <dt className="text-cadet/50">effort</dt>
              <dd>{pattern.friction_dial} / 5</dd>
            </>
          )}
          {pattern.start_in_120s && (
            <>
              <dt className="text-cadet/50">quick start</dt>
              <dd>ready in 2 minutes</dd>
            </>
          )}
          {(pattern.arc_emphasis as string[])?.length > 0 && (
            <>
              <dt className="text-cadet/50">focus</dt>
              <dd>{(pattern.arc_emphasis as string[]).join(", ")}</dd>
            </>
          )}
          {(pattern.required_forms as string[])?.length > 0 && (
            <>
              <dt className="text-cadet/50">shapes needed</dt>
              <dd>{(pattern.required_forms as string[]).join(", ")}</dd>
            </>
          )}
        </dl>
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
            includes &ldquo;spot it again&rdquo;
          </h2>
          <p className="text-sm text-cadet/70 mb-4">
            after you play, there&apos;s a prompt that helps kids (and you)
            notice the same idea popping up in totally different places.
            &ldquo;spot it again&rdquo; prompts unlock when you grab the full
            kit.
          </p>
          <Link
            href={pack ? `/packs/${pack.slug}` : "/packs"}
            className="inline-block rounded-lg bg-redwood px-4 py-2 text-sm text-white font-medium hover:bg-sienna transition-colors"
          >
            {pack ? `get ${pack.title}` : "see kits"}
          </Link>
        </section>
      )}
    </main>
  );
}
