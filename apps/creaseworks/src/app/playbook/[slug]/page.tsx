/**
 * Collection detail — playdates in this collection with user progress badges.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-helpers";
import {
  getCollectionBySlug,
  getCollectionPlaydates,
  getCollectionEvidenceSummary,
  recomputeUserProgress,
  type CollectionPlaydate,
} from "@/lib/queries/collections";
import { PlaydateCard, type ProgressTier } from "@/components/ui/playdate-card";
import QuickLogButton from "@/components/ui/quick-log-button";
import CollectionExportButton from "@/components/collection-export-button";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CollectionDetailPage({ params }: Props) {
  const { slug } = await params;
  const session = await requireAuth();

  // Recompute progress before rendering
  await recomputeUserProgress(session.userId);

  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();

  const [playdates, evidenceSummary] = await Promise.all([
    getCollectionPlaydates(collection.id, session.userId),
    getCollectionEvidenceSummary(collection.id, session.userId),
  ]);

  const triedCount = playdates.filter((p: CollectionPlaydate) => p.progress_tier).length;
  const foundCount = playdates.filter(
    (p: CollectionPlaydate) =>
      p.progress_tier &&
      ["found_something", "folded_unfolded", "found_again"].includes(p.progress_tier),
  ).length;
  const foldedCount = playdates.filter(
    (p: CollectionPlaydate) =>
      p.progress_tier &&
      ["folded_unfolded", "found_again"].includes(p.progress_tier),
  ).length;
  const foundAgainCount = playdates.filter(
    (p: CollectionPlaydate) => p.progress_tier === "found_again",
  ).length;

  const pct =
    playdates.length > 0 ? Math.round((triedCount / playdates.length) * 100) : 0;

  // Determine the best progress nudge (show at most one)
  let nudge: string | null = null;
  if (triedCount > 0 && evidenceSummary.total === 0) {
    nudge = `you've tried ${triedCount} playdate${triedCount !== 1 ? "s" : ""} — capture some photos or quotes to unlock the found something tier.`;
  } else if (foundCount > 0 && foldedCount === 0) {
    nudge =
      "try a playdate again in a different week to unlock the folded & unfolded tier.";
  } else if (foldedCount > 0 && foundAgainCount === 0) {
    nudge =
      "notice a playdate moment in everyday life? mark it as a find again moment on your next reflection.";
  }

  return (
    <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
      {/* back link */}
      <Link
        href="/playbook"
        className="text-xs text-cadet/40 hover:text-cadet/60 transition-colors mb-6 inline-block"
      >
        &larr; back to playbook
      </Link>

      {/* header with export button */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-start gap-3">
          {collection.icon_emoji && (
            <span className="text-3xl leading-none mt-1" aria-hidden>
              {collection.icon_emoji}
            </span>
          )}
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {collection.title}
            </h1>
            {collection.description && (
              <p className="text-cadet/50 text-sm mt-1">
                {collection.description}
              </p>
            )}
          </div>
        </div>
        <CollectionExportButton
          collectionSlug={collection.slug}
          collectionTitle={collection.title}
        />
      </div>

      {/* progress bar */}
      <div className="mt-4 mb-8">
        <div className="h-1.5 rounded-full bg-cadet/5 overflow-hidden max-w-sm">
          <div
            className="h-full rounded-full bg-champagne transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11px] text-cadet/40 mt-1.5">
          {triedCount} of {playdates.length} tried
          {foundAgainCount > 0 && (
            <span className="text-redwood/70">
              {" "}
              · {foundAgainCount} found again
            </span>
          )}
        </p>
      </div>

      {/* progress nudge */}
      {nudge && (
        <p
          className="text-sm rounded-lg px-4 py-3 mb-6"
          style={{
            color: "rgba(39, 50, 72, 0.55)",
            backgroundColor: "rgba(228, 196, 137, 0.12)",
          }}
        >
          {nudge}
        </p>
      )}

      {/* evidence summary */}
      {evidenceSummary.total > 0 && (
        <div className="mb-8 flex items-center justify-between">
          <div className="flex flex-wrap gap-3 text-xs text-cadet/50">
            <span>{evidenceSummary.total} piece{evidenceSummary.total !== 1 ? "s" : ""} of evidence</span>
            {evidenceSummary.photos > 0 && (
              <span>📸 {evidenceSummary.photos} photo{evidenceSummary.photos !== 1 ? "s" : ""}</span>
            )}
            {evidenceSummary.quotes > 0 && (
              <span>💬 {evidenceSummary.quotes} quote{evidenceSummary.quotes !== 1 ? "s" : ""}</span>
            )}
            {evidenceSummary.observations > 0 && (
              <span>📝 {evidenceSummary.observations} observation{evidenceSummary.observations !== 1 ? "s" : ""}</span>
            )}
          </div>
          <Link
            href="/playbook/portfolio"
            className="text-xs text-sienna/70 hover:text-sienna transition-colors whitespace-nowrap"
          >
            view in portfolio &rarr;
          </Link>
        </div>
      )}

      {/* playdate grid */}
      {playdates.length === 0 ? (
        <p className="text-sm text-cadet/40 py-12 text-center">
          no playdates in this collection yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {playdates.map((p) => (
            <PlaydateCard
              key={p.id}
              slug={p.slug}
              title={p.title}
              headline={p.headline}
              primaryFunction={p.primary_function}
              arcEmphasis={p.arc_emphasis ?? []}
              contextTags={[]}
              frictionDial={p.friction_dial}
              startIn120s={p.start_in_120s}
              hasFindAgain={p.has_find_again}
              progressTier={(p.progress_tier as ProgressTier) ?? null}
              evidenceCount={p.evidence_count}
              tinkeringTier={p.tinkering_tier}
              runCount={p.run_count}
              href={`/sampler/${p.slug}`}
              action={
                <QuickLogButton
                  playdateId={p.id}
                  playdateTitle={p.title}
                />
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}
