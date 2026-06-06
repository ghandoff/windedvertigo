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

// Icon: Font Awesome fa-universal-access (CC BY 4.0, fontawesome.com/license/free)
// The recognised WCAG/web standard accessibility icon — ring + person figure.
// Compound path; requires fill-rule="evenodd" so the ring gaps show through.
function AccessibilityIcon() {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="currentColor"
      fillRule="evenodd"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M256 48c114.953 0 208 93.029 208 208 0 114.953-93.029 208-208 208-114.953 0-208-93.029-208-208 0-114.953 93.029-208 208-208m0-40C119.033 8 8 119.033 8 256s111.033 248 248 248 248-111.033 248-248S392.967 8 256 8zm0 56C149.961 64 64 149.961 64 256s85.961 192 192 192 192-85.961 192-192S362.039 64 256 64zm0 44c19.882 0 36 16.118 36 36s-16.118 36-36 36-36-16.118-36-36 16.118-36 36-36zm117.741 98.023c-28.712 6.779-55.511 12.748-82.14 15.807.851 101.023 12.306 123.052 25.037 155.621 3.617 9.26-.957 19.698-10.217 23.315-9.261 3.617-19.699-.957-23.316-10.217-8.705-22.308-17.086-40.636-22.261-78.549h-9.686c-5.167 37.851-13.534 56.208-22.262 78.549-3.615 9.255-14.05 13.836-23.315 10.217-9.26-3.617-13.834-14.056-10.217-23.315 12.713-32.541 24.185-54.541 25.037-155.621-26.629-3.058-53.428-9.027-82.141-15.807-8.6-2.031-13.926-10.648-11.895-19.249s10.647-13.926 19.249-11.895c96.686 22.829 124.283 22.783 220.775 0 8.599-2.03 17.218 3.294 19.249 11.895 2.029 8.601-3.297 17.219-11.897 19.249z" />
    </svg>
  );
}
