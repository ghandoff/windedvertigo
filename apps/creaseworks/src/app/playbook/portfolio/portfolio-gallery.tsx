"use client";

/**
 * Portfolio gallery — client component that fetches and displays
 * evidence in a visual grid with filtering and lightbox.
 *
 * Phase C — evidence portfolio (practitioner tier).
 * Phase D — added export PDF + share link buttons.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { apiUrl } from "@/lib/api-url";
import EvidenceLightbox, {
  type LightboxItem,
} from "@/components/ui/evidence-lightbox";

type EvidenceType = "photo" | "quote" | "observation" | "artifact";

interface PortfolioItem extends LightboxItem {
  storage_key?: string | null;
  thumbnail_key?: string | null;
}

const TYPE_FILTERS: { key: EvidenceType | "all"; label: string }[] = [
  { key: "all", label: "all" },
  { key: "photo", label: "photos" },
  { key: "quote", label: "quotes" },
  { key: "observation", label: "observations" },
  { key: "artifact", label: "artifacts" },
];

export default function PortfolioGallery({
  playdates,
}: {
  /** Available playdates for the filter dropdown. */
  playdates: { slug: string; title: string }[];
}) {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<EvidenceType | "all">("all");
  const [playdateFilter, setPlaydateFilter] = useState("");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpiry, setShareExpiry] = useState<string | null>(null);
  const sharePopoverRef = useRef<HTMLDivElement>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (playdateFilter) params.set("playdate", playdateFilter);
    params.set("limit", "100");

    try {
      const res = await fetch(apiUrl(`/api/evidence/portfolio?${params}`));
      if (!res.ok) throw new Error("failed to fetch");
      const data = await res.json();
      setItems(data.items);
      setTotal(data.pagination.total);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, playdateFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Close share popover on outside click
  useEffect(() => {
    if (!shareUrl) return;
    function handleClick(e: MouseEvent) {
      if (
        sharePopoverRef.current &&
        !sharePopoverRef.current.contains(e.target as Node)
      ) {
        setShareUrl(null);
        setShareExpiry(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [shareUrl]);

  /* ── export PDF handler ── */
  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format: "pdf" });
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (playdateFilter) params.set("playdate", playdateFilter);

      const res = await fetch(apiUrl(`/api/evidence/export?${params}`));
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "export failed");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?(.+?)"?$/);
      const filename = match?.[1] || "creaseworks-evidence.pdf";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "export failed");
    } finally {
      setExporting(false);
    }
  }

  /* ── share link handler ── */
  async function handleShare() {
    setSharing(true);
    try {
      const body: Record<string, string> = {};
      if (typeFilter !== "all") body.type = typeFilter;
      if (playdateFilter) body.playdate = playdateFilter;

      const res = await fetch(apiUrl("/api/evidence/share"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "could not create share link");
      }

      const data = await res.json();
      const fullUrl = `${window.location.origin}${data.url}`;
      setShareUrl(fullUrl);
      setShareExpiry(data.expiresAt);
    } catch (err) {
      alert(err instanceof Error ? err.message : "share failed");
    } finally {
      setSharing(false);
    }
  }

  function copyShareUrl() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
  }

  return (
    <div>
      {/* ── filters ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* type pills */}
        <div className="flex gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className="text-xs px-3 py-1.5 rounded-full border transition-all"
              style={{
                backgroundColor:
                  typeFilter === f.key
                    ? "rgba(203, 120, 88, 0.12)"
                    : "transparent",
                borderColor:
                  typeFilter === f.key
                    ? "var(--wv-sienna)"
                    : "rgba(39, 50, 72, 0.12)",
                color:
                  typeFilter === f.key
                    ? "var(--wv-sienna)"
                    : "var(--wv-cadet)",
                fontWeight: typeFilter === f.key ? 600 : 400,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* playdate filter */}
        {playdates.length > 0 && (
          <select
            value={playdateFilter}
            onChange={(e) => setPlaydateFilter(e.target.value)}
            className="text-xs rounded-lg border border-cadet/15 px-2 py-1.5 bg-white outline-none"
          >
            <option value="">all playdates</option>
            {playdates.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title}
              </option>
            ))}
          </select>
        )}

        {/* count + actions */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-cadet/40">
            {total} item{total !== 1 ? "s" : ""}
          </span>

          {/* share button */}
          {!loading && items.length > 0 && (
            <div className="relative">
              <button
                onClick={handleShare}
                disabled={sharing}
                className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:bg-cadet/5 disabled:opacity-50"
                style={{
                  borderColor: "rgba(39, 50, 72, 0.15)",
                  color: "var(--wv-cadet)",
                }}
              >
                {sharing ? "creating..." : "share"}
              </button>

              {/* share popover */}
              {shareUrl && (
                <div
                  ref={sharePopoverRef}
                  className="absolute right-0 top-full mt-2 w-72 rounded-xl border bg-white shadow-lg p-4 z-20"
                  style={{ borderColor: "rgba(39, 50, 72, 0.1)" }}
                >
                  <p className="text-xs font-medium text-cadet mb-2">
                    shareable link
                  </p>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 text-xs rounded-lg border border-cadet/15 px-2 py-1.5 bg-cadet/3 outline-none truncate"
                    />
                    <button
                      onClick={copyShareUrl}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: "var(--wv-redwood)" }}
                    >
                      copy
                    </button>
                  </div>
                  {shareExpiry && (
                    <p className="text-[10px] text-cadet/40 mt-2">
                      expires{" "}
                      {new Date(shareExpiry).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* export PDF button */}
          {!loading && items.length > 0 && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--wv-redwood)" }}
            >
              {exporting ? "exporting..." : "export PDF"}
            </button>
          )}
        </div>
      </div>

      {/* ── loading state ── */}
      {loading && (
        <div className="py-16 text-center">
          <div
            className="inline-block w-6 h-6 border-2 rounded-full animate-spin"
            style={{
              borderColor: "var(--wv-sienna)",
              borderTopColor: "transparent",
            }}
          />
        </div>
      )}

      {/* ── empty state ── */}
      {!loading && items.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-sm text-cadet/40">
            {typeFilter !== "all" || playdateFilter
              ? "no evidence matches these filters."
              : "no evidence captured yet. add photos, quotes, and observations when you log a reflection."}
          </p>
        </div>
      )}

      {/* ── masonry-ish grid ── */}
      {!loading && items.length > 0 && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => setLightboxIdx(idx)}
              className="group rounded-xl overflow-hidden border border-cadet/8 bg-white
                         hover:shadow-warm transition-shadow text-left"
            >
              {item.evidence_type === "photo" && item.thumbUrl ? (
                <div className="aspect-square bg-cadet/5">
                  <img
                    src={item.thumbUrl}
                    alt={`evidence from ${item.run_title}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : item.evidence_type === "quote" ? (
                <div
                  className="aspect-square flex items-center justify-center p-4"
                  style={{ backgroundColor: "rgba(203, 120, 88, 0.06)" }}
                >
                  <div className="text-center">
                    <p className="text-xs italic text-cadet/70 line-clamp-4 leading-relaxed">
                      &ldquo;{item.quote_text}&rdquo;
                    </p>
                    {item.quote_attribution && (
                      <p className="text-[10px] text-cadet/40 mt-1.5">
                        — {item.quote_attribution}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="aspect-square flex flex-col justify-center p-4"
                  style={{ backgroundColor: "rgba(39, 50, 72, 0.03)" }}
                >
                  {item.prompt_key && (
                    <p className="text-[10px] font-medium text-sienna/60 mb-1">
                      {item.prompt_key.replace(/_/g, " ")}
                    </p>
                  )}
                  <p className="text-xs text-cadet/60 line-clamp-5 leading-relaxed">
                    {item.body}
                  </p>
                </div>
              )}

              {/* caption strip */}
              <div className="px-3 py-2 border-t border-cadet/5">
                <p className="text-[11px] font-medium text-cadet truncate">
                  {item.playdate_title ?? item.run_title}
                </p>
                <p className="text-[10px] text-cadet/40">
                  {item.run_date
                    ? new Date(item.run_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── lightbox ── */}
      {lightboxIdx !== null && items[lightboxIdx] && (
        <EvidenceLightbox
          item={items[lightboxIdx]}
          onClose={() => setLightboxIdx(null)}
          onPrev={() =>
            setLightboxIdx((prev) =>
              prev !== null && prev > 0 ? prev - 1 : prev,
            )
          }
          onNext={() =>
            setLightboxIdx((prev) =>
              prev !== null && prev < items.length - 1 ? prev + 1 : prev,
            )
          }
          hasPrev={lightboxIdx > 0}
          hasNext={lightboxIdx < items.length - 1}
        />
      )}
    </div>
  );
}

