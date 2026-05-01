/**
 * Profile "what's next" section — recommended unowned packs.
 *
 * Shows up to 3 packs the org hasn't unlocked yet, ranked by
 * overlap with the user's tried arc_emphasis tags.
 *
 * Server component — data comes from getRecommendedPacks().
 */

import Link from "next/link";

interface RecommendedPack {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  playdate_count: number;
  arc_overlap: number;
}

interface ProfileWhatsNextProps {
  packs: RecommendedPack[];
}

export default function ProfileWhatsNext({ packs }: ProfileWhatsNextProps) {
  if (packs.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold tracking-tight mb-1">
        what&apos;s next
      </h2>
      <p className="text-sm text-cadet/40 mb-4">
        packs we think your family would love.
      </p>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {packs.map((pack) => (
          <Link
            key={pack.id}
            href={`/packs/${pack.slug}`}
            className="block rounded-xl border border-dashed border-sienna/20 bg-sienna/3 p-4 hover:border-sienna/40 hover:bg-sienna/5 transition-all"
          >
            <h3 className="text-sm font-semibold text-cadet mb-1 truncate">
              {pack.title}
            </h3>

            {pack.description && (
              <p className="text-xs text-cadet/45 mb-2 line-clamp-2">
                {pack.description}
              </p>
            )}

            <div className="flex items-center gap-2 text-xs text-cadet/40">
              <span>{pack.playdate_count} playdates</span>
              {pack.arc_overlap > 0 && (
                <>
                  <span className="text-cadet/15">&middot;</span>
                  <span className="text-sienna/70">
                    matches your play style
                  </span>
                </>
              )}
            </div>

            <span className="mt-2 inline-block text-xs text-sienna font-medium">
              see what&apos;s inside &rarr;
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
