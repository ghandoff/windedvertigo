/**
 * /find/material/[slug] — "what can I do with this?"
 *
 * material-first entry into the system-of-play.
 * shows a material's form, its possible functions, and all
 * playdates that use it. inverts the usual matcher flow.
 */

import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getMaterialBySlug,
  getPlaydatesForMaterial,
} from "@/lib/queries/materials";
import { batchGetMaterialsForPlaydates } from "@/lib/queries/playdates";
import { PlaydateCard } from "@/components/ui/playdate-card";
import CharacterSlot, { resolveCharacterFromForm } from "@windedvertigo/characters";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const material = await getMaterialBySlug(slug);
  if (!material) return { title: "material not found" };
  return {
    title: material.title,
    description: `explore what you can do with ${material.title} — see its form, functions, and matching playdates.`,
  };
}

/* ── function → colour mapping ── */
const FUNCTION_COLOURS: Record<string, string> = {
  connector: "var(--wv-teal)",
  base: "var(--wv-cadet)",
  container: "var(--wv-cornflower)",
  "mark making": "var(--wv-sienna)",
  shaping: "var(--wv-redwood)",
  dividing: "var(--wv-moss)",
  joining: "var(--wv-teal)",
  stacking: "var(--wv-navy)",
};

function getFunctionColour(fn: string): string {
  const lower = fn.toLowerCase();
  for (const [key, colour] of Object.entries(FUNCTION_COLOURS)) {
    if (lower.includes(key)) return colour;
  }
  return "var(--wv-cadet)";
}

export default async function MaterialDetailPage({ params }: Props) {
  const { slug } = await params;
  const material = await getMaterialBySlug(slug);
  if (!material) notFound();

  const playdates = await getPlaydatesForMaterial(material.id);

  // batch-fetch materials for all linked playdates (for card icons)
  const materialsMap = await batchGetMaterialsForPlaydates(
    playdates.map((p: { id: string }) => p.id),
  );

  const iconPath = material.icon
    ? `/harbour/creaseworks/icons/materials/${material.icon}.png`
    : null;
  const functions: string[] = material.functions ?? [];
  const characterName = resolveCharacterFromForm(material.form_primary, material.title);

  return (
    <main className="min-h-screen px-4 pt-8 pb-24 sm:px-6 sm:pt-14 sm:pb-16">
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* back link */}
        <Link
          href="/find"
          className="text-xs text-cadet/40 hover:text-cadet/60 transition-colors mb-6 inline-block"
        >
          &larr; back to find
        </Link>

        {/* material hero */}
        <div className="flex items-start gap-5 mb-8">
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-2xl"
            style={{
              width: 80,
              height: 80,
              backgroundColor: "rgba(39, 50, 72, 0.04)",
            }}
          >
            {iconPath ? (
              <Image
                src={iconPath}
                alt={material.title}
                width={56}
                height={56}
                className="object-contain"
              />
            ) : (
              <span className="text-4xl leading-none">
                {material.emoji ?? "✨"}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-cadet">
                {material.title}
              </h1>
              {characterName && (
                <CharacterSlot character={characterName} size={80} animate={false} variant="kid" />
              )}
            </div>
            {material.form_primary && (
              <p className="text-sm text-cadet/50 mb-3">
                form: <span className="font-medium text-cadet/70">{material.form_primary}</span>
              </p>
            )}

            {/* function pills */}
            {functions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {functions.map((fn: string) => (
                  <span
                    key={fn}
                    className="inline-block rounded-full px-3 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${getFunctionColour(fn)} 12%, transparent)`,
                      color: getFunctionColour(fn),
                    }}
                  >
                    {fn}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* what can this become? */}
        <section>
          <h2 className="text-sm font-semibold text-cadet/50 uppercase tracking-wider mb-4">
            playdates with {material.title}
          </h2>

          {playdates.length === 0 ? (
            <div
              className="text-center py-12 rounded-xl"
              style={{ background: "var(--wv-cream)", border: "1.5px solid rgba(39, 50, 72, 0.08)" }}
            >
              <p className="text-cadet/40 text-sm">
                no playdates use this material yet — check back as we add more!
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {playdates.map((p: Record<string, unknown>) => (
                <PlaydateCard
                  key={p.id as string}
                  slug={p.slug as string}
                  title={p.title as string}
                  headline={p.headline as string | null}
                  primaryFunction={p.primary_function as string | null}
                  arcEmphasis={(p.arc_emphasis as string[]) ?? []}
                  contextTags={(p.context_tags as string[]) ?? []}
                  frictionDial={p.friction_dial as number | null}
                  startIn120s={p.start_in_120s as boolean}
                  hasFindAgain={p.has_find_again as boolean}
                  runCount={p.run_count as number}
                  tinkeringTier={p.tinkering_tier as string | null}
                  coverUrl={p.cover_url as string | null}
                  visibleFields={p.gallery_visible_fields as string[] | null}
                  materials={materialsMap.get(p.id as string) ?? null}
                />
              ))}
            </div>
          )}
        </section>

        {/* community link */}
        <div className="mt-8 text-center">
          <Link
            href={`/community/material/${slug}`}
            className="inline-flex items-center gap-2 text-sm font-medium transition-all hover:opacity-80"
            style={{ color: "var(--wv-seafoam)" }}
          >
            see how others use {material.title} &rarr;
          </Link>
        </div>

        {/* add to workshop CTA */}
        <div className="mt-10 text-center">
          <Link
            href="/workshop"
            className="inline-block rounded-xl px-6 py-3 text-sm font-medium transition-all hover:shadow-md"
            style={{
              backgroundColor: "rgba(203, 120, 88, 0.1)",
              color: "var(--wv-sienna)",
            }}
          >
            add {material.title} to your workshop &rarr;
          </Link>
        </div>
      </div>
    </main>
  );
}
