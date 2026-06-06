"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAnimations } from "@/lib/animation-context";
import { useAccessibility } from "@/lib/accessibility-context";

const PANEL_ID = "a11y-panel";

type ToggleRow = {
  label: string;
  key: "still" | "textLg" | "highContrast" | "wideSpacing" | "dyslexiaFont" | "highlightLinks" | "bigCursor" | "readingGuide" | "grayscale";
};

const TOGGLES: ToggleRow[] = [
  { label: "stop animations",  key: "still"          },
  { label: "bigger text",      key: "textLg"         },
  { label: "high contrast",    key: "highContrast"   },
  { label: "wide spacing",     key: "wideSpacing"    },
  { label: "legible font",     key: "dyslexiaFont"   },
  { label: "highlight links",  key: "highlightLinks" },
  { label: "big cursor",       key: "bigCursor"      },
  { label: "reading guide",    key: "readingGuide"   },
  { label: "grayscale",        key: "grayscale"      },
];

export function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { paused: still, toggle: toggleStill } = useAnimations();
  const a11y = useAccessibility();

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Close on Escape, click-outside
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const onPointer = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, close]);

  // Move focus into panel when opened
  useEffect(() => {
    if (open) {
      const first = panelRef.current?.querySelector<HTMLElement>("button, [tabindex]");
      first?.focus();
    }
  }, [open]);

  function getState(key: ToggleRow["key"]): boolean {
    if (key === "still") return still;
    return a11y[key];
  }

  function handleToggle(key: ToggleRow["key"]) {
    if (key === "still") { toggleStill(); return; }
    a11y.toggle(key);
  }

  return (
    <>
      <button
        ref={triggerRef}
        className={`a11y-trigger${open ? " a11y-trigger--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label={open ? "close accessibility options" : "open accessibility options"}
      >
        <AccessibilityIcon />
      </button>

      <div
        id={PANEL_ID}
        ref={panelRef}
        className={`a11y-panel${open ? " a11y-panel--open" : ""}`}
        role="dialog"
        aria-label="accessibility options"
        aria-hidden={!open}
      >
        <div className="a11y-panel-inner">
          <p className="a11y-panel-title">accessibility</p>
          <ul className="a11y-toggle-list">
            {TOGGLES.map(({ label, key }) => (
              <li key={key} className="a11y-toggle-item">
                <span
                  className="a11y-toggle-label"
                  id={`a11y-label-${key}`}
                >
                  {label}
                </span>
                <button
                  role="switch"
                  aria-checked={getState(key)}
                  aria-labelledby={`a11y-label-${key}`}
                  className="a11y-switch"
                  onClick={() => handleToggle(key)}
                  tabIndex={open ? 0 : -1}
                />
              </li>
            ))}
          </ul>
        </div>
        <button
          className="a11y-reset"
          onClick={() => { if (still) toggleStill(); a11y.resetAll(); }}
          tabIndex={open ? 0 : -1}
        >
          reset all
        </button>
      </div>
    </>
  );
}

function AccessibilityIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="6.5" r="1.5" fill="currentColor" />
      <path d="M9 10.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 10.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 14.5l-1.5 3M14 14.5l1.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
