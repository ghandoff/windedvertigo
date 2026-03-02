"use client";

import { useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import type { VaultActivity } from "@/lib/types";
import { typeColor } from "@/lib/types";
import { markdownToHtml } from "@/lib/markdown";

interface VaultDetailModalProps {
  activity: VaultActivity | null;
  onClose: () => void;
}

export default function VaultDetailModal({
  activity,
  onClose,
}: VaultDetailModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!activity) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activity, onClose]);

  // Focus management: save previous focus, restore on close, lock body scroll
  useEffect(() => {
    if (activity && panelRef.current) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      panelRef.current.focus();
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [activity]);

  // Trap Tab/Shift+Tab within the modal
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    []
  );

  if (!activity) return null;

  const accent = typeColor(activity.type[0]);
  const contentHtml = markdownToHtml(activity.content);

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* sliding panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={activity.name.trim()}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="fixed top-0 right-0 z-50 h-full w-full max-w-[560px] overflow-y-auto shadow-2xl animate-slide-in outline-none"
        style={{ backgroundColor: "var(--vault-card-bg)" }}
      >
        {/* colour bar */}
        <div className="h-1.5" style={{ backgroundColor: accent }} />

        {/* cover image */}
        {activity.coverImage && (
          <div className="relative w-full" style={{ aspectRatio: "21/9" }}>
            <Image
              src={activity.coverImage}
              alt={activity.name.trim()}
              fill
              sizes="(max-width: 560px) 100vw, 560px"
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/60 hover:text-white z-10"
          aria-label="Close"
        >
          ✕
        </button>

        {/* header */}
        <div className="px-8 pt-7 pb-0">
          {/* type row */}
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider mb-3">
            {activity.type.map((t) => (
              <span
                key={t}
                className="rounded-full px-2.5 py-0.5 font-medium text-white/90"
                style={{ backgroundColor: typeColor(t) }}
              >
                {t}
              </span>
            ))}
            {activity.duration && (
              <span className="opacity-40">{activity.duration}</span>
            )}
          </div>

          {/* name */}
          <h2 className="text-xl font-bold leading-snug mb-2">
            {activity.name.trim()}
          </h2>

          {/* headline */}
          {activity.headline && (
            <p className="text-sm opacity-60 leading-relaxed mb-4">
              {activity.headline}
            </p>
          )}

          {/* format tags */}
          {activity.format.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {activity.format.map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider opacity-50"
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* divider */}
        <hr className="border-white/8 mx-8" />

        {/* content (instructions) */}
        {contentHtml && (
          <div className="px-8 py-6">
            <div
              className="vault-content text-sm"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          </div>
        )}

        {/* skills developed */}
        {activity.skillsDeveloped.length > 0 && (
          <>
            <hr className="border-white/8 mx-8" />
            <div className="px-8 py-6">
              <h3 className="text-xs uppercase tracking-wider opacity-40 mb-3">
                skills developed
              </h3>
              <div className="flex flex-wrap gap-2">
                {activity.skillsDeveloped.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-white/15 px-3 py-1 text-xs opacity-70"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
