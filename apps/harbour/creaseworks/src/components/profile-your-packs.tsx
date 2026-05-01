/**
 * Profile "your packs" section — owned packs with per-pack progress.
 *
 * Shows each entitled pack as a card with a progress bar showing
 * tried / total playdates, tier badge distribution, and a link
 * to the pack detail page.
 *
 * Server component — data comes from getOrgPacksWithProgress().
 */

import Link from "next/link";

interface OwnedPack {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  playdate_count: number;
  tried_count: number;
  found_count: number;
  folded_count: number;
  found_again_count: number;
}

interface ProfileYourPacksProps {
  packs: OwnedPack[];
}

export default function ProfileYourPacks({ packs }: ProfileYourPacksProps) {
  if (packs.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold tracking-tight mb-1">your packs</h2>
      <p className="text-sm text-cadet/40 mb-4">
        playdates you&apos;ve unlocked — tap a pack to dive in.
      </p>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {packs.map((pack) => {
          const pct =
            pack.playdate_count > 0
              ? Math.round((pack.tried_count / pack.playdate_count) * 100)
              : 0;

          return (
            <Link
              key={pack.id}
              href={`/packs/${pack.slug}`}
              className="block rounded-xl border border-cadet/10 bg-white p-5 shadow-sm hover:shadow-md hover:border-sienna/30 transition-all"
            >
              <h3 className="text-base font-semibold text-cadet mb-1 truncate">
                {pack.title}
              </h3>

              {pack.description && (
                <p className="text-xs text-cadet/50 mb-3 line-clamp-2">
                  {pack.description}
                </p>
              )}

              {/* progress bar */}
              <div className="mb-2">
                <div className="h-2 rounded-full bg-cadet/8 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor:
                        pct >= 80
                          ? "var(--wv-redwood)"
                          : pct >= 40
                            ? "var(--wv-sienna)"
                            : "var(--wv-champagne)",
                    }}
                  />
                </div>
              </div>

              {/* stats line */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-cadet/50">
                <span>
                  {pack.tried_count} of {pack.playdate_count} tried
                </span>
                {pack.found_count > 0 && (
                  <>
                    <span className="text-cadet/15">&middot;</span>
                    <span className="text-champagne">{pack.found_count} found</span>
                  </>
                )}
                {pack.folded_count > 0 && (
                  <>
                    <span className="text-cadet/15">&middot;</span>
                    <span className="text-sienna/70">{pack.folded_count} folded</span>
                  </>
                )}
                {pack.found_again_count > 0 && (
                  <>
                    <span className="text-cadet/15">&middot;</span>
                    <span className="text-redwood/70">{pack.found_again_count} found again</span>
                  </>
                )}
              </div>

              <span className="mt-3 inline-block text-xs text-sienna/60 font-medium">
                see pack &rarr;
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
