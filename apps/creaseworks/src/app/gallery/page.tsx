/**
 * /gallery — community gallery of approved evidence
 *
 * Public page showing approved evidence contributions from the community.
 * Displays photos, quotes, and observations in a responsive masonry grid.
 *
 * Features:
 * - Responsive grid (1 col mobile, 2 col tablet, 3 col desktop)
 * - Anonymous display (user first name only)
 * - Playdate context for each contribution
 * - Call-to-action for logged-in users to share their play
 */

import { getSession } from "@/lib/auth-helpers";
import Link from "next/link";
import Image from "next/image";
import { getGalleryEvidence, countGalleryEvidence } from "@/lib/queries/gallery";

export const dynamic = "force-dynamic";

const ITEMS_PER_PAGE = 30;

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const offset = (page - 1) * ITEMS_PER_PAGE;

  const session = await getSession();

  const [items, total] = await Promise.all([
    getGalleryEvidence(ITEMS_PER_PAGE, offset),
    countGalleryEvidence(),
  ]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const hasMore = page < totalPages;
  const hasPrevious = page > 1;

  return (
    <main className="min-h-screen px-4 pt-8 pb-24 sm:px-6 sm:pt-12 sm:pb-12 max-w-6xl mx-auto">
      {/* ---- header ---- */}
      <div className="mb-12">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-3">
          community gallery
        </h1>
        <p
          className="text-base text-cadet/60 max-w-2xl mb-6"
          style={{ color: "var(--wv-cadet)", opacity: 0.65 }}
        >
          explore evidence of play from our community — photos, discoveries, and
          moments of joy from playdates around the world.
        </p>

        {/* CTA for logged-in users */}
        {session ? (
          <Link
            href="/profile?manage=true"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              backgroundColor: "var(--wv-sienna)",
              color: "white",
            }}
          >
            <span>share your play</span>
            <span aria-hidden>→</span>
          </Link>
        ) : (
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              backgroundColor: "rgba(140, 110, 80, 0.1)",
              color: "var(--wv-sienna)",
              border: "1px solid rgba(140, 110, 80, 0.2)",
            }}
          >
            <span>sign in to share</span>
            <span aria-hidden>→</span>
          </Link>
        )}
      </div>

      {/* ---- gallery grid ---- */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-sienna/15 bg-sienna/[0.03] p-10 text-center max-w-md mx-auto">
          {/* brand-aligned illustration: simple frame with sparkle */}
          <svg
            viewBox="0 0 80 60"
            width={80}
            height={60}
            className="mx-auto mb-4"
            aria-hidden="true"
          >
            <rect x="8" y="8" width="50" height="38" rx="3" fill="none" stroke="var(--wv-sienna)" strokeWidth="1.5" opacity="0.4" />
            <circle cx="22" cy="22" r="5" fill="none" stroke="var(--wv-sienna)" strokeWidth="1" opacity="0.3" />
            <path d="M8 38l14-10 10 6 12-12 14 16" stroke="var(--wv-sienna)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.3" />
            <path d="M66 12l2 4 4 0.5-3 3 0.5 4-3.5-2-3.5 2 0.5-4-3-3 4-0.5z" fill="var(--wv-champagne)" stroke="var(--wv-sienna)" strokeWidth="0.8" opacity="0.6" />
          </svg>
          <p
            className="text-base font-medium mb-1"
            style={{ color: "var(--wv-sienna)" }}
          >
            the gallery is growing
          </p>
          <p className="text-sm text-cadet/50">
            community creations will appear here soon. try a playdate and share what you discover.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 wv-stagger">
            {items.map((item) => (
              <GalleryCard key={item.id} item={item} />
            ))}
          </div>

          {/* ---- pagination ---- */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-12">
              {hasPrevious && (
                <Link
                  href={`/gallery?page=${page - 1}`}
                  className="px-4 py-2 rounded-lg font-medium transition-all"
                  style={{
                    backgroundColor: "rgba(39, 50, 72, 0.05)",
                    color: "var(--wv-cadet)",
                    border: "1px solid rgba(39, 50, 72, 0.1)",
                  }}
                >
                  ← previous
                </Link>
              )}
              <p
                className="text-sm"
                style={{ color: "var(--wv-cadet)", opacity: 0.6 }}
              >
                {page} of {totalPages}
              </p>
              {hasMore && (
                <Link
                  href={`/gallery?page=${page + 1}`}
                  className="px-4 py-2 rounded-lg font-medium transition-all"
                  style={{
                    backgroundColor: "rgba(39, 50, 72, 0.05)",
                    color: "var(--wv-cadet)",
                    border: "1px solid rgba(39, 50, 72, 0.1)",
                  }}
                >
                  next →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}

/* ---- gallery card component ---- */

interface GalleryCardProps {
  item: Awaited<ReturnType<typeof getGalleryEvidence>>[0];
}

function GalleryCard({ item }: GalleryCardProps) {
  const isImage = item.evidence_type === "photo";
  const isQuote = item.evidence_type === "quote";
  const isObservation = item.evidence_type === "observation";

  return (
    <div
      className="rounded-lg overflow-hidden border h-full flex flex-col transition-all hover:shadow-lg"
      style={{
        borderColor: "rgba(39, 50, 72, 0.1)",
        backgroundColor: "white",
      }}
    >
      {/* image or observation preview */}
      {isImage && item.storage_key ? (
        <div className="relative w-full bg-cadet/5" style={{ aspectRatio: "1" }}>
          <Image
            src={`https://cdn.creaseworks.co/${item.storage_key}`}
            alt="gallery evidence"
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      ) : isQuote ? (
        <div
          className="p-4 flex items-center justify-center text-center min-h-[200px]"
          style={{
            backgroundColor: "rgba(140, 110, 80, 0.03)",
            color: "var(--wv-cadet)",
          }}
        >
          <blockquote className="italic text-sm leading-relaxed">
            {item.quote_text && `"${item.quote_text}"`}
          </blockquote>
        </div>
      ) : isObservation ? (
        <div
          className="p-4 flex items-center justify-center min-h-[200px]"
          style={{
            backgroundColor: "rgba(39, 50, 72, 0.03)",
            color: "var(--wv-cadet)",
          }}
        >
          <p className="text-sm leading-relaxed">{item.body}</p>
        </div>
      ) : null}

      {/* metadata footer */}
      <div className="p-4 border-t flex-1 flex flex-col justify-between"
        style={{
          borderColor: "rgba(39, 50, 72, 0.1)",
        }}
      >
        {/* attribution */}
        <div className="mb-3">
          {item.playdate_title && (
            <p
              className="text-xs font-semibold tracking-wide uppercase mb-1"
              style={{ color: "var(--wv-sienna)" }}
            >
              {item.playdate_title}
            </p>
          )}
          {isQuote && item.quote_attribution && (
            <p
              className="text-xs"
              style={{ color: "var(--wv-cadet)", opacity: 0.7 }}
            >
              — {item.quote_attribution}
            </p>
          )}
        </div>

        {/* uploader info */}
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
