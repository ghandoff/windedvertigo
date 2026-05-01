/**
 * /admin/gallery — community gallery moderation
 *
 * Admin page for reviewing and approving evidence submissions to the
 * community gallery. Shows pending items with approve/reject buttons.
 */

import { requireAdmin } from "@/lib/auth-helpers";
import Image from "next/image";
import { getPendingGalleryItems, countPendingGalleryItems } from "@/lib/queries/gallery";
import GalleryModerationActions from "./moderation-actions";

export const dynamic = "force-dynamic";

const ITEMS_PER_PAGE = 12;

export default async function AdminGalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const offset = (page - 1) * ITEMS_PER_PAGE;

  const [items, total] = await Promise.all([
    getPendingGalleryItems(session, ITEMS_PER_PAGE, offset),
    countPendingGalleryItems(session),
  ]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const hasMore = page < totalPages;
  const hasPrevious = page > 1;

  return (
    <main className="min-h-screen px-6 py-16 max-w-6xl mx-auto">
      <div className="mb-12">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          gallery moderation
        </h1>
        <p
          className="text-sm mb-6"
          style={{ color: "var(--wv-cadet)", opacity: 0.6 }}
        >
          review and approve evidence submissions for the community gallery.
          <span className="block mt-2 font-semibold">
            {total} pending {total === 1 ? "item" : "items"}
          </span>
        </p>
      </div>

      {items.length === 0 ? (
        <div
          className="rounded-xl border p-8 text-center"
          style={{
            borderColor: "rgba(39, 50, 72, 0.15)",
            backgroundColor: "rgba(39, 50, 72, 0.03)",
          }}
        >
          <p
            className="text-base"
            style={{ color: "var(--wv-cadet)", opacity: 0.6 }}
          >
            no pending gallery submissions
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-6 mb-12">
            {items.map((item) => (
              <ModerationCard key={item.id} item={item} />
            ))}
          </div>

          {/* pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              {hasPrevious && (
                <a
                  href={`/admin/gallery?page=${page - 1}`}
                  className="px-4 py-2 rounded-lg font-medium transition-all"
                  style={{
                    backgroundColor: "rgba(39, 50, 72, 0.05)",
                    color: "var(--wv-cadet)",
                    border: "1px solid rgba(39, 50, 72, 0.1)",
                  }}
                >
                  ← previous
                </a>
              )}
              <p
                className="text-sm"
                style={{ color: "var(--wv-cadet)", opacity: 0.6 }}
              >
                {page} of {totalPages}
              </p>
              {hasMore && (
                <a
                  href={`/admin/gallery?page=${page + 1}`}
                  className="px-4 py-2 rounded-lg font-medium transition-all"
                  style={{
                    backgroundColor: "rgba(39, 50, 72, 0.05)",
                    color: "var(--wv-cadet)",
                    border: "1px solid rgba(39, 50, 72, 0.1)",
                  }}
                >
                  next →
                </a>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}

/* ---- moderation card ---- */

function ModerationCard({
  item,
}: {
  item: Awaited<ReturnType<typeof getPendingGalleryItems>>[0];
}) {
  const isImage = item.evidence_type === "photo";
  const isQuote = item.evidence_type === "quote";
  const isObservation = item.evidence_type === "observation";

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        borderColor: "rgba(39, 50, 72, 0.15)",
        backgroundColor: "rgba(39, 50, 72, 0.02)",
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-6">
        {/* preview */}
        <div className="sm:col-span-1">
          {isImage && item.storage_key ? (
            <div className="relative w-full rounded-lg overflow-hidden bg-cadet/5"
              style={{ aspectRatio: "1" }}
            >
              <Image
                src={`https://cdn.creaseworks.co/${item.storage_key}`}
                alt="submission preview"
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 25vw"
              />
            </div>
          ) : (
            <div
              className="rounded-lg flex items-center justify-center p-4 text-center text-xs"
              style={{
                aspectRatio: "1",
                backgroundColor: isQuote ? "rgba(140, 110, 80, 0.05)" : "rgba(39, 50, 72, 0.05)",
                color: "var(--wv-cadet)",
              }}
            >
              {isQuote && "quote"}
              {isObservation && "observation"}
            </div>
          )}
        </div>

        {/* content */}
        <div className="sm:col-span-3 flex flex-col justify-between">
          <div>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded"
                  style={{
                    backgroundColor: "rgba(140, 110, 80, 0.1)",
                    color: "var(--wv-sienna)",
                  }}
                >
                  {item.evidence_type}
                </span>
              </div>

              {isQuote && item.quote_text && (
                <>
                  <blockquote
                    className="italic text-sm mb-2 leading-relaxed"
                    style={{ color: "var(--wv-cadet)" }}
                  >
                    "{item.quote_text}"
                  </blockquote>
                  {item.quote_attribution && (
                    <p
                      className="text-xs"
                      style={{ color: "var(--wv-cadet)", opacity: 0.6 }}
                    >
                      — {item.quote_attribution}
                    </p>
                  )}
                </>
              )}

              {isObservation && item.body && (
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--wv-cadet)" }}
                >
                  {item.body}
                </p>
              )}
            </div>

            {/* metadata */}
            <div className="text-xs space-y-1"
              style={{ color: "var(--wv-cadet)", opacity: 0.6 }}
            >
              {item.playdate_title && (
                <p><span className="font-semibold">playdate:</span> {item.playdate_title}</p>
              )}
              <p><span className="font-semibold">submitted by:</span> {item.user_first_name} ({item.user_email})</p>
              <p><span className="font-semibold">submitted:</span> {new Date(item.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {/* actions */}
          <GalleryModerationActions evidenceId={item.id} />
        </div>
      </div>
    </div>
  );
}
