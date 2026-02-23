/**
 * Collection detail — patterns in this collection with user progress badges.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-helpers";
import {
  getCollectionBySlug,
  getCollectionPatterns,
  recomputeUserProgress,
} from "@/lib/queries/collections";
import { PatternCard, type ProgressTier } from "@/components/ui/pattern-card";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export default async function CollectionDetailPage({ params }: Props) {
  const session = await requireAuth();

  // Recompute progress before rendering
  await recomputeUserProgress(session.userId);

  const collection = await getCollectionBySlug(params.slug);
  if (!collection) notFound();

  const patterns = await getCollectionPatterns(collection.id, session.userId);

  const triedCount = patterns.filter((p) => p.progress_tier).length;
  const foundAgainCount = patterns.filter(
    (p) => p.progress_tier === "found_again",
  ).length;

  const pct =
    patterns.length > 0 ? Math.round((triedCount / patterns.length) * 100) : 0;

  return (
    <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
      {/* back link */}
      <Link
        href="/playbook"
        className="text-xs text-cadet/40 hover:text-cadet/60 transition-colors mb-6 inline-block"
      >
        &larr; back to playbook
      </Link>

      {/* header */}
      <div className="flex items-start gap-3 mb-2">
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

      {/* progress bar */}
      <div className="mt-4 mb-8">
        <div className="h-1.5 rounded-full bg-cadet/5 overflow-hidden max-w-sm">
          <div
            className="h-full rounded-full bg-champagne transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11px] text-cadet/40 mt-1.5">
          {triedCount} of {patterns.length} tried
          {foundAgainCount > 0 && (
            <span className="text-redwood/70">
              {" "}
              · {foundAgainCount} found again
            </span>
          )}
        </p>
      </div>

      {/* pattern grid */}
      {patterns.length === 0 ? (
        <p className="text-sm text-cadet/40 py-12 text-center">
          no playdates in this collection yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {patterns.map((p) => (
            <PatternCard
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
            />
          ))}
        </div>
      )}
    </main>
  );
}
