/**
 * /log — the "unfold" tab: reflect and surface what changed.
 *
 * Merged view combining:
 *   1. Reflection form (RunForm) — for authenticated users
 *   2. Gallery (community evidence) — for everyone, as inspiration
 *
 * Authenticated users see the reflection form on top ("capture what happened")
 * followed by the gallery below ("see what others discovered").
 * Unauthenticated users see a sign-in prompt then the gallery.
 *
 * The gallery below the form creates a feedback loop: after logging a
 * reflection, users immediately see community evidence — including their
 * own — which reinforces the cycle and motivates further sharing.
 *
 * Part of the winded.vertigo creative cycle: find → fold → unfold → find again
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { getSession } from "@/lib/auth-helpers";
import { getReadyPlaydatesForPicker } from "@/lib/queries/runs";
import { getAllMaterials } from "@/lib/queries/materials";
import { getFirstVisiblePackForPlaydate, getPackBySlug } from "@/lib/queries/packs";
import { checkEntitlement } from "@/lib/queries/entitlements";
import { getGalleryEvidence, countGalleryEvidence } from "@/lib/queries/gallery";
import RunForm from "@/components/ui/run-form/run-form";
import type { ReflectionPackInfo } from "@/components/ui/run-form/run-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "log",
  description:
    "reflect and surface what changed — log a reflection and explore community evidence for inspiration.",
};

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ playdate?: string; page?: string }>;
}) {
  const session = await getSession();

  return (
    <main className="min-h-screen px-6 pt-16 pb-24 sm:pb-16 max-w-5xl mx-auto">
      {/* ── page header ── */}
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          unfold
        </h1>
        <p className="text-cadet/60 max-w-lg text-sm">
          reflect and surface what changed — log what happened during your
          playdate, then explore what others have discovered.
        </p>
      </header>

      {/* ── reflection form section ── */}
      {session ? (
        <Suspense fallback={<ReflectionSkeleton />}>
          <ReflectionSection
            userId={session.userId}
            orgId={session.orgId}
            isInternal={session.isInternal}
            isAdmin={session.isAdmin}
            searchParams={searchParams}
          />
        </Suspense>
      ) : (
        <section className="mb-12">
          <div
            className="rounded-xl border px-6 py-8 text-center"
            style={{
              borderColor: "rgba(228, 196, 137, 0.3)",
              backgroundColor: "rgba(228, 196, 137, 0.06)",
            }}
          >
            <p className="text-base font-semibold text-cadet mb-2">
              ready to reflect?
            </p>
            <p className="text-sm text-cadet/50 mb-4 max-w-md mx-auto">
              sign in to log what happened during your playdate — what you
              noticed, what surprised you, and what you&apos;d try next.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all"
              style={{
                backgroundColor: "var(--wv-champagne)",
                color: "var(--wv-cadet)",
              }}
            >
              sign in to reflect <span aria-hidden>&rarr;</span>
            </Link>
          </div>
        </section>
      )}

      {/* ── visual separator ── */}
      <div className="border-t border-cadet/8 my-10" />

      {/* ── gallery section (everyone) ── */}
      <Suspense fallback={<GallerySkeleton />}>
        <GallerySection searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────
 * ReflectionSection — reflection form (authed only)
 * ───────────────────────────────────────────────────────────── */

async function ReflectionSection({
  userId,
  orgId,
  isInternal,
  isAdmin,
  searchParams,
}: {
  userId: string;
  orgId: string | null;
  isInternal: boolean;
  isAdmin: boolean;
  searchParams: Promise<{ playdate?: string; page?: string }>;
}) {
  const { playdate: playdateSlug } = await searchParams;

  const [playdates, materials] = await Promise.all([
    getReadyPlaydatesForPicker(),
    getAllMaterials(),
  ]);

  // Resolve slug to ID for pre-selection
  const matchedPlaydate = playdateSlug
    ? playdates.find((p: any) => p.slug === playdateSlug)
    : null;
  const initialPlaydateId = matchedPlaydate?.id ?? "";

  // Look up pack info for upsell CTA (only for unentitled packs)
  let packInfo: ReflectionPackInfo | null = null;
  if (matchedPlaydate) {
    const pack = await getFirstVisiblePackForPlaydate(matchedPlaydate.id);
    if (pack) {
      const isEntitled = await checkEntitlement(orgId, pack.id, userId);
      if (!isEntitled) {
        const fullPack = await getPackBySlug(pack.slug);
        if (fullPack) {
          packInfo = {
            packSlug: pack.slug,
            packTitle: pack.title,
            playdateCount: Number(fullPack.playdate_count) || 0,
          };
        }
      }
    }
  }

  /**
   * Practitioner-level access for evidence capture:
   * - Internal users (windedvertigo.com emails) always have it
   * - Admins always have it
   * - Users with an org have it (entitled via pack purchase)
   */
  const isPractitioner = isInternal || isAdmin || !!orgId;

  return (
    <section className="mb-4">
      <h2 className="text-lg font-semibold text-cadet mb-1">
        log a reflection
      </h2>
      <p className="text-xs text-cadet/40 mb-6">
        capture what happened — what you noticed, what surprised you,
        what you&apos;d try next.
      </p>

      <div className="max-w-3xl">
        <RunForm
          playdates={playdates}
          materials={materials}
          isPractitioner={isPractitioner}
          initialPlaydateId={initialPlaydateId}
          packInfo={packInfo}
        />
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * GallerySection — community evidence for inspiration (everyone)
 * ───────────────────────────────────────────────────────────── */

const GALLERY_ITEMS_PER_PAGE = 12;

async function GallerySection({
  searchParams,
}: {
  searchParams: Promise<{ playdate?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const offset = (page - 1) * GALLERY_ITEMS_PER_PAGE;

  const [items, total] = await Promise.all([
    getGalleryEvidence(GALLERY_ITEMS_PER_PAGE, offset),
    countGalleryEvidence(),
  ]);

  const totalPages = Math.ceil(total / GALLERY_ITEMS_PER_PAGE);
  const hasMore = page < totalPages;
  const hasPrevious = page > 1;

  return (
    <section>
      <h2 className="text-lg font-semibold text-cadet mb-1">
        community evidence
      </h2>
      <p className="text-xs text-cadet/40 mb-6">
        photos, quotes, and observations from the community — see what
        others have discovered.
      </p>

      {items.length === 0 ? (
        <div className="rounded-xl border border-champagne/20 bg-champagne/[0.04] p-8 text-center max-w-sm mx-auto">
          <p className="text-3xl mb-3" aria-hidden>
            🦋
          </p>
          <p
            className="text-sm font-medium mb-1"
            style={{ color: "var(--wv-champagne)" }}
          >
            the gallery is growing
          </p>
          <p className="text-xs text-cadet/40">
            community creations will appear here soon. try a playdate and
            share what you discover.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 wv-stagger">
            {items.map((item) => (
              <GalleryCard key={item.id} item={item} />
            ))}
          </div>

          {/* pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              {hasPrevious && (
                <Link
                  href={`/log?page=${page - 1}`}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: "rgba(39, 50, 72, 0.05)",
                    color: "var(--wv-cadet)",
                    border: "1px solid rgba(39, 50, 72, 0.1)",
                  }}
                >
                  &larr; previous
                </Link>
              )}
              <p
                className="text-xs"
                style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
              >
                {page} of {totalPages}
              </p>
              {hasMore && (
                <Link
                  href={`/log?page=${page + 1}`}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: "rgba(39, 50, 72, 0.05)",
                    color: "var(--wv-cadet)",
                    border: "1px solid rgba(39, 50, 72, 0.1)",
                  }}
                >
                  next &rarr;
                </Link>
              )}
            </div>
          )}

          {/* full gallery link */}
          <div className="text-center mt-6">
            <Link
              href="/gallery"
              className="text-xs text-cadet/40 hover:text-cadet/60 transition-colors"
            >
              view the full gallery &rarr;
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

/* ── gallery card (inline) ── */

function GalleryCard({
  item,
}: {
  item: Awaited<ReturnType<typeof getGalleryEvidence>>[0];
}) {
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
          className="p-4 flex items-center justify-center text-center min-h-[160px]"
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
          className="p-4 flex items-center justify-center min-h-[160px]"
          style={{
            backgroundColor: "rgba(39, 50, 72, 0.03)",
            color: "var(--wv-cadet)",
          }}
        >
          <p className="text-sm leading-relaxed">{item.body}</p>
        </div>
      ) : null}

      <div
        className="p-3 border-t flex-1 flex flex-col justify-between"
        style={{ borderColor: "rgba(39, 50, 72, 0.1)" }}
      >
        <div className="mb-2">
          {item.playdate_title && (
            <p
              className="text-2xs font-semibold tracking-wide mb-0.5"
              style={{ color: "var(--wv-sienna)" }}
            >
              {item.playdate_title}
            </p>
          )}
          {isQuote && item.quote_attribution && (
            <p
              className="text-2xs"
              style={{ color: "var(--wv-cadet)", opacity: 0.7 }}
            >
              — {item.quote_attribution}
            </p>
          )}
        </div>
        <p
          className="text-2xs"
          style={{ color: "var(--wv-cadet)", opacity: 0.45 }}
        >
          shared by {item.user_first_name}
        </p>
      </div>
    </div>
  );
}

/* ── loading skeletons ── */

function ReflectionSkeleton() {
  return (
    <section className="mb-4 animate-pulse">
      <div className="h-5 w-36 bg-cadet/5 rounded mb-4" />
      <div className="max-w-3xl space-y-4">
        <div className="h-10 bg-cadet/5 rounded-lg" />
        <div className="h-10 bg-cadet/5 rounded-lg" />
        <div className="h-24 bg-cadet/5 rounded-lg" />
        <div className="h-10 w-32 bg-cadet/5 rounded-lg" />
      </div>
    </section>
  );
}

function GallerySkeleton() {
  return (
    <section className="animate-pulse">
      <div className="h-5 w-40 bg-cadet/5 rounded mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-48 bg-cadet/5 rounded-xl" />
        ))}
      </div>
    </section>
  );
}
