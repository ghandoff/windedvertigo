"use client";

import { useState, useId } from "react";

/**
 * Accordion-style section that starts expanded on desktop, collapsed on
 * mobile (via the defaultOpen prop). Shows a count badge when items are
 * selected and the section is collapsed.
 */
export function FilterSection({
  title,
  subtitle,
  selectedCount,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle?: string;
  selectedCount: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section
      className="rounded-xl border transition-colors"
      style={{ borderColor: "rgba(39, 50, 72, 0.1)", backgroundColor: "var(--wv-white)" }}
    >
      {/* section header — always visible, acts as toggle */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <h2
            className="text-sm font-semibold truncate"
            style={{ color: "var(--wv-cadet)", opacity: 0.8 }}
          >
            {title}
          </h2>
          {selectedCount > 0 && (
            <span
              className="flex-shrink-0 inline-flex items-center justify-center rounded-full text-xs font-medium"
              style={{
                backgroundColor: "var(--wv-redwood)",
                color: "var(--wv-white)",
                minWidth: 22,
                height: 22,
                padding: "0 6px",
              }}
            >
              {selectedCount}
            </span>
          )}
        </div>
        {/* chevron indicator */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="flex-shrink-0 transition-transform duration-200"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            opacity: 0.4,
          }}
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="var(--wv-cadet)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* collapsible body */}
      {open && (
        <div id={panelId} role="region" className="px-4 pb-4 sm:px-5 sm:pb-5">
          {subtitle && (
            <p
              className="text-xs mb-3"
              style={{ color: "var(--wv-cadet)", opacity: 0.45 }}
            >
              {subtitle}
            </p>
          )}
          {children}
        </div>
      )}
    </section>
  );
}
