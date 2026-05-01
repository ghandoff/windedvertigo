"use client";

import { useState, useId } from "react";

/**
 * Playful accordion section with emoji icon, warm colours when active,
 * and a bouncy expand/collapse animation.
 *
 * Kid refresh (2026-04): tuned for the light find-phase bg — cream
 * surface, cadet text.
 */
export function FilterSection({
  title, subtitle, emoji, selectedCount, defaultOpen = true, children,
}: {
  title: string;
  subtitle?: string;
  emoji?: string;
  selectedCount: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const hasItems = selectedCount > 0;

  return (
    <section
      className="rounded-2xl border-2 transition-all duration-300"
      style={{
        borderColor: hasItems ? "rgba(177, 80, 67, 0.25)" : "rgba(39, 50, 72, 0.08)",
        backgroundColor: hasItems ? "rgba(255, 246, 232, 0.95)" : "rgba(255, 246, 232, 0.7)",
        boxShadow: hasItems ? "0 2px 12px rgba(177, 80, 67, 0.07)" : "0 1px 4px rgba(39, 50, 72, 0.06)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {emoji && (
            <span className="text-xl flex-shrink-0" style={{
              transition: "transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              transform: open ? "scale(1.15) rotate(-5deg)" : "scale(1)",
            }}>{emoji}</span>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-bold truncate" style={{ color: "var(--wv-cadet)" }}>{title}</h2>
            {subtitle && !open && (
              <p className="text-xs truncate mt-0.5" style={{ color: "var(--wv-cadet)", opacity: 0.45 }}>{subtitle}</p>
            )}
          </div>
          {hasItems && (
            <span className="flex-shrink-0 inline-flex items-center justify-center rounded-full text-xs font-bold"
              style={{
                backgroundColor: "var(--wv-redwood)",
                color: "var(--wv-white)",
                minWidth: 24, height: 24, padding: "0 7px",
                animation: "filterBadgePop 300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}>
              {selectedCount}
            </span>
          )}
        </div>
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0"
          style={{
            transition: "transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            opacity: 0.35,
          }}>
          <path d="M4 6L8 10L12 6" stroke="var(--wv-cadet)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div id={panelId} role="region" className="px-5 pb-5">
          {subtitle && (
            <p className="text-xs mb-3" style={{ color: "var(--wv-cadet)", opacity: 0.5 }}>{subtitle}</p>
          )}
          {children}
        </div>
      )}
      <style>{`
        @keyframes filterBadgePop {
          from { transform: scale(0); } 60% { transform: scale(1.3); } to { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes filterBadgePop { from, to { transform: scale(1); } }
        }
      `}</style>
    </section>
  );
}
