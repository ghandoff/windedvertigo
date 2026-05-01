"use client";

import { useState, useRef, useEffect } from "react";
import { useAgeLevel } from "@/lib/age-context";

interface Props {
  /** the jargon term displayed inline */
  term: string;
  /** plain-english definition shown in tooltip */
  definition: string;
  children?: React.ReactNode;
}

/**
 * JargonTip — renders a term with age-appropriate tooltip behavior.
 *
 * - professional: renders the term as-is, no tooltip
 * - highschool:   renders underlined, hover reveals definition
 * - kids:         renders with a small "?" icon, tap reveals definition
 */
export function JargonTip({ term, definition, children }: Props) {
  const level = useAgeLevel();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // close tooltip when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  // professional: no tooltip, render as-is
  if (level === "professional") {
    return <>{children || term}</>;
  }

  // highschool: underline + hover tooltip
  if (level === "highschool") {
    return (
      <span
        ref={ref}
        className="relative inline-block"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <span className="underline decoration-dotted decoration-[var(--rh-teal)]/40 underline-offset-2 cursor-help">
          {children || term}
        </span>
        {open && (
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-[var(--rh-deep)] text-white text-xs leading-snug whitespace-nowrap shadow-lg z-50 pointer-events-none">
            <span className="font-semibold">{term}</span>: {definition}
            <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-[var(--rh-deep)]" />
          </span>
        )}
      </span>
    );
  }

  // kids: "?" badge + tap tooltip
  return (
    <span ref={ref} className="relative inline-block">
      <span
        onClick={() => setOpen(!open)}
        className="cursor-pointer"
      >
        {children || term}
        <span className="inline-flex items-center justify-center w-3.5 h-3.5 ml-0.5 rounded-full bg-[var(--rh-cyan)]/20 text-[var(--rh-teal)] text-[9px] font-bold leading-none align-super">
          ?
        </span>
      </span>
      {open && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2.5 rounded-xl bg-[var(--rh-deep)] text-white text-xs leading-relaxed shadow-lg z-50 min-w-[180px] max-w-[260px] whitespace-normal">
          <span className="font-semibold text-[var(--rh-cyan)]">{term}</span>
          <br />
          {definition}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-[var(--rh-deep)]" />
        </span>
      )}
    </span>
  );
}
