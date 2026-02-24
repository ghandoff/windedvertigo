"use client";

/**
 * Lightbox for viewing a single evidence item in detail.
 *
 * Renders as a modal overlay with:
 * - Full-size photo (for photo evidence)
 * - Large quote display
 * - Observation text
 * - Reflection + playdate context
 * - Left/right navigation arrows
 * - Close on backdrop click or Escape
 *
 * Phase C — evidence portfolio (practitioner tier).
 */

import { useEffect, useCallback } from "react";

export interface LightboxItem {
  id: string;
  evidence_type: string;
  photoUrl?: string | null;
  thumbUrl?: string | null;
  quote_text?: string | null;
  quote_attribution?: string | null;
  body?: string | null;
  prompt_key?: string | null;
  created_at: string;
  run_title: string;
  run_date: string | null;
  playdate_title?: string | null;
  playdate_slug?: string | null;
}

export default function EvidenceLightbox({
  item,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  item: LightboxItem;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
    },
    [onClose, onPrev, onNext, hasPrev, hasNext],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const dateStr = item.run_date
    ? new Date(item.run_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* content */}
      <div
        className="relative max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col rounded-2xl overflow-hidden bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/30 text-white flex items-center justify-center
                     hover:bg-black/50 transition-colors text-sm"
          aria-label="close"
        >
          ×
        </button>

        {/* main content area */}
        <div className="flex-1 overflow-y-auto">
          {item.evidence_type === "photo" && item.photoUrl ? (
            <div className="bg-black/5 flex items-center justify-center min-h-[300px]">
              <img
                src={item.photoUrl}
                alt={`evidence from ${item.run_title}`}
                className="max-w-full max-h-[60vh] object-contain"
              />
            </div>
          ) : item.evidence_type === "quote" ? (
            <div className="px-8 py-12 flex items-center justify-center min-h-[200px]">
              <div className="text-center max-w-lg">
                <p className="text-xl sm:text-2xl italic text-cadet/80 leading-relaxed">
                  &ldquo;{item.quote_text}&rdquo;
                </p>
                {item.quote_attribution && (
                  <p className="text-sm text-cadet/50 mt-3">
                    — {item.quote_attribution}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="px-8 py-8 min-h-[150px]">
              {item.prompt_key && (
                <p className="text-xs font-medium text-sienna/70 mb-2">
                  {item.prompt_key.replace(/_/g, " ")}
                </p>
              )}
              <p className="text-sm text-cadet/80 leading-relaxed whitespace-pre-wrap">
                {item.body}
              </p>
            </div>
          )}
        </div>

        {/* footer: context + nav */}
        <div className="border-t border-cadet/10 px-6 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-cadet truncate">
              {item.playdate_title ?? item.run_title}
            </p>
            <p className="text-xs text-cadet/40">
              {dateStr}
              <span className="mx-1.5 text-cadet/15">&middot;</span>
              {item.evidence_type}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              className="w-8 h-8 rounded-full border border-cadet/10 text-cadet/50 flex items-center justify-center
                         disabled:opacity-20 hover:bg-cadet/5 transition-colors text-sm"
              aria-label="previous"
            >
              ‹
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="w-8 h-8 rounded-full border border-cadet/10 text-cadet/50 flex items-center justify-center
                         disabled:opacity-20 hover:bg-cadet/5 transition-colors text-sm"
              aria-label="next"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
