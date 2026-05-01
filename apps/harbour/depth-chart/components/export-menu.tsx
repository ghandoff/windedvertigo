"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface ExportOption {
  label: string;
  description: string;
  action: () => void | Promise<void>;
}

interface ExportMenuProps {
  options: ExportOption[];
  label?: string;
}

export function ExportMenu({ options, label = "export" }: ExportMenuProps) {
  const [open, set_open] = useState(false);
  const [loading, set_loading] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        set_open(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handle_click = useCallback(async (opt: ExportOption) => {
    set_loading(opt.label);
    try {
      await opt.action();
    } catch (e) {
      console.error("[export]", e);
    } finally {
      set_loading(null);
      set_open(false);
    }
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => set_open(!open)}
        className="text-xs font-medium text-[var(--color-text-on-dark-muted)] hover:text-[var(--wv-champagne)] transition-colors"
      >
        {label} ↓
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-2 w-56 bg-[var(--wv-cadet)] border border-white/15 rounded-lg shadow-xl z-40 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.label}
              onClick={() => handle_click(opt)}
              disabled={loading !== null}
              className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors disabled:opacity-50 border-b border-white/5 last:border-0"
            >
              <span className="block text-xs font-medium text-[var(--color-text-on-dark)]">
                {loading === opt.label ? "exporting..." : opt.label}
              </span>
              <span className="block text-[10px] text-[var(--color-text-on-dark-muted)] mt-0.5">
                {opt.description}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
