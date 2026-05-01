/**
 * /community/material/[slug] — "see how others used [material]"
 *
 * the LEGO idea moment — you see someone used a tube as a mark maker
 * and think "I never thought of that!" groups evidence by function
 * so the creative variety is visible at a glance.
 */

import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getMaterialBySlug } from "@/lib/queries/materials";
import { getGalleryEvidenceByMaterial } from "@/lib/queries/gallery";
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
    title: `how families use ${material.title}`,
    description: `see how other families have used ${material.title} in creative play — photos, quotes, and observations grouped by function.`,
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

export default async function CommunityMaterialPage({ params }: Props) {
  const { slug } = await params;
  const material = await getMaterialBySlug(slug);
  if (!material) notFound();

  const items = await getGalleryEvidenceByMaterial(material.id, 60);

  const iconPath = material.icon
    ? `/harbour/creaseworks/icons/materials/${material.icon}.png`
    : null;
  const functions: string[] = material.functions ?? [];
  const characterName = resolveCharacterFromForm(material.form_primary, material.title);

  /* group items by function_used — null/empty → "general" */
  const groupMap = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.function_used?.trim() || "general";
    const group = groupMap.get(key) ?? [];
    group.push(item);
    groupMap.set(key, group);
  }
  const functionGroups = [...groupMap.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  return (
    <main className="min-h-screen px-4 pt-8 pb-24">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* breadcrumb */}
        <Link
          href="/gallery"
          className="text-xs text-cadet/40 hover:text-cadet/60 transition-colors mb-6 inline-block"
        >
          &larr; back to gallery
        </Link>

        {/* ── material hero (compact) ── */}
        <div className="flex items-center gap-4 mb-8">
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-xl"
            style={{
              width: 48,
              height: 48,
              backgroundColor: "rgba(39, 50, 72, 0.04)",
            }}
          >
            {iconPath ? (
              <Image
                src={iconPath}
                alt={material.title}
                width={32}
                height={32}
                className="object-contain"
              />
            ) : (
              <span className="text-2xl leading-none">
                {material.emoji ?? "✨"}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-cadet">
                how families use {material.title}
              </h1>
              {characterName && (
                <CharacterSlot character={characterName} size={80} animate={false} variant="kid" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {material.form_primary && (
                <span
                  className="inline-block rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: "rgba(39, 50, 72, 0.06)",
                    color: "var(--wv-cadet)",
                  }}
                >
                  {material.form_primary}
                </span>
              )}
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
          </div>
        </div>

        {/* ── empty state ── */}
        {items.length === 0 ? (
          <div className="text-center py-14 rounded-xl border max-w-md mx-auto"
            style={{ borderColor: "rgba(39, 50, 72, 0.1)" }}
          >
            <p
              className="text-base font-medium mb-2"
              style={{ color: "var(--wv-cadet)" }}
            >
              no community photos for {material.title} yet. be the first!
            </p>
            <Link
              href={`/find/material/${slug}`}
              className="inline-flex items-center gap-1 text-sm font-medium transition-all hover:opacity-80"
              style={{ color: "var(--wv-sienna)" }}
            >
              try a playdate with {material.title} &rarr;
            </Link>
          </div>
        ) : (
          /* ── grouped gallery sections ── */
          functionGroups.map(([functionName, groupItems]) => (
            <section key={functionName} className="mb-10">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider mb-4">
                {functionName === "general" ? (
                  <span style={{ color: "var(--wv-cadet)", opacity: 0.5 }}>
                    general
                  </span>
                ) : (
                  <>
                    <span style={{ color: "var(--wv-cadet)", opacity: 0.5 }}>
                      as a
                    </span>
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold normal-case"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${getFunctionColour(functionName)} 12%, transparent)`,
                        color: getFunctionColour(functionName),
                      }}
                    >
                      {functionName}
                    </span>
                  </>
                )}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupItems.map((item) => (
                  <GalleryCard
                    key={item.id}
                    item={item}
                    functionUsed={item.function_used}
                  />
                ))}
              </div>
            </section>
          ))
        )}

        {/* ── bottom CTAs ── */}
        <div className="flex flex-wrap gap-4 justify-center mt-12">
          <Link
            href={`/find/material/${slug}`}
            className="inline-block rounded-xl px-6 py-3 text-sm font-medium transition-all hover:shadow-md"
            style={{
              backgroundColor: "rgba(203, 120, 88, 0.1)",
              color: "var(--wv-sienna)",
            }}
          >
            try a playdate with {material.title} &rarr;
          </Link>
          <Link
            href="/gallery"
            className="inline-block rounded-xl px-6 py-3 text-sm font-medium transition-all hover:shadow-md"
            style={{
              backgroundColor: "rgba(39, 50, 72, 0.06)",
              color: "var(--wv-cadet)",
            }}
          >
            back to gallery
          </Link>
        </div>
      </div>
    </main>
  );
}

/* ── gallery card ── */

type GalleryItemWithFunction = Awaited<
  ReturnType<typeof getGalleryEvidenceByMaterial>
>[0];

interface GalleryCardProps {
  item: GalleryItemWithFunction;
  functionUsed: string | null;
}

function GalleryCard({ item, functionUsed }: GalleryCardProps) {
  const isImage = item.evidence_type === "photo";
  const isQuote = item.evidence_type === "quote";
  const isObservation = item.evidence_type === "observation";

  return (
    <div
      className="relative rounded-lg overflow-hidden h-full flex flex-col transition-all hover:shadow-lg"
      style={{
        background: "var(--wv-cream)",
        border: "1.5px solid rgba(39, 50, 72, 0.08)",
      }}
    >
      {/* function pill badge (top-right, absolute) */}
      {functionUsed && (
        <span
          className="absolute top-2 right-2 z-10 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor: `color-mix(in srgb, ${getFunctionColour(functionUsed)} 20%, white)`,
            color: getFunctionColour(functionUsed),
            border: `1px solid color-mix(in srgb, ${getFunctionColour(functionUsed)} 30%, transparent)`,
          }}
        >
          {functionUsed}
        </span>
      )}

      {/* photo card */}
      {isImage && item.storage_key ? (
        <div
          className="relative w-full bg-cadet/5"
          style={{ aspectRatio: "1" }}
        >
          <Image
            src={`https://cdn.creaseworks.co/${item.storage_key}`}
            alt="community evidence"
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      ) : isQuote ? (
        /* quote card */
        <div
          className="p-4 flex flex-col justify-center min-h-[200px]"
          style={{
            backgroundColor: "rgba(140, 110, 80, 0.03)",
            color: "var(--wv-cadet)",
          }}
        >
          <blockquote className="italic text-sm leading-relaxed text-center mb-2">
            {item.quote_text && `\u201c${item.quote_text}\u201d`}
          </blockquote>
          {item.quote_attribution && (
            <p
              className="text-xs text-center"
              style={{ color: "var(--wv-cadet)", opacity: 0.7 }}
            >
              — {item.quote_attribution}
            </p>
          )}
        </div>
      ) : isObservation ? (
        /* observation card */
        <div
          className="p-4 flex flex-col justify-center min-h-[200px]"
          style={{
            backgroundColor: "rgba(39, 50, 72, 0.03)",
            color: "var(--wv-cadet)",
          }}
        >
          <p className="text-sm leading-relaxed">{item.body}</p>
        </div>
      ) : null}

      {/* metadata footer */}
      <div
        className="p-3 border-t flex-1 flex flex-col justify-between"
        style={{ borderColor: "rgba(39, 50, 72, 0.1)" }}
      >
        {item.playdate_title && (
          <p
            className="text-xs font-semibold tracking-wide mb-1"
            style={{ color: "var(--wv-sienna)" }}
          >
            {item.playdate_title}
          </p>
        )}
        <p
          className="text-xs"
          style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
        >
          shared by {item.user_first_name}
        </p>
      </div>
    </div>
  );
}
