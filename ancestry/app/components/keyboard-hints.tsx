"use client";

import { useState, useEffect, useRef } from "react";

const SHORTCUTS = [
  { keys: ["\u2318/ctrl", "K"], description: "search" },
  { keys: ["\u2191"], description: "navigate to parent" },
  { keys: ["\u2193"], description: "navigate to child" },
  { keys: ["\u2190"], description: "previous sibling" },
  { keys: ["\u2192"], description: "next sibling" },
  { keys: ["tab"], description: "go to spouse" },
  { keys: ["enter"], description: "open person" },
  { keys: ["esc"], description: "close overlays" },
];

export function KeyboardHints() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="fixed bottom-4 right-4 z-40" ref={panelRef}>
      {open && (
        <div className="mb-2 w-64 rounded-xl border border-border bg-card shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-xs font-semibold text-foreground">keyboard shortcuts</h3>
          </div>
          <div className="px-4 py-2 space-y-1.5">
            {SHORTCUTS.map((s) => (
              <div key={s.description} className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">{s.description}</span>
                <div className="flex gap-1">
                  {s.keys.map((k) => (
                    <kbd
                      key={k}
                      className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground hover:shadow-md transition-all"
        title="keyboard shortcuts"
      >
        <span className="text-sm font-medium">?</span>
      </button>
    </div>
  );
}
