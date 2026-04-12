"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTutorial } from "./tutorial-provider";

const SECTIONS = [
  {
    title: "getting started",
    items: [
      "click any person card to see details in a side panel",
      "double-click a card to open the full profile for editing",
      "right-click a card for quick actions (add relative, delete, etc.)",
      "use the sidebar to add new people and relationships",
    ],
  },
  {
    title: "canvas interactions",
    items: [
      "click + drag on empty space to pan around",
      "scroll wheel to zoom in and out",
      "shift + drag to draw a selection box around multiple cards",
      "shift + click to add/remove cards from selection",
      "drag a card near another to see alignment snap guides",
      "ctrl+z / ctrl+shift+z to undo/redo moves",
    ],
  },
  {
    title: "chart views",
    items: [
      "pedigree — ancestors going up from a root person",
      "descendancy — descendants going down from a focal person",
      "hourglass — ancestors + descendants from a focal person",
      "fan — radial view of ancestors in concentric rings",
      "map — geographic view of places and events",
      "timeline — chronological lifespan bars",
    ],
  },
  {
    title: "keyboard shortcuts",
    items: [
      "arrow keys — navigate between relatives (up=parents, down=children)",
      "tab — jump to spouse",
      "enter — open focused person's full profile",
      "escape — close side panel or context menu",
      "ctrl+z — undo last move",
      "ctrl+shift+z — redo",
    ],
  },
];

export function HelpDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const { resetTour } = useTutorial();

  // close on escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // close on click outside
  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    },
    [],
  );

  const handleReplayTour = useCallback(() => {
    setIsOpen(false);
    // small delay so the drawer closes before tour starts
    setTimeout(() => resetTour(), 300);
  }, [resetTour]);

  return (
    <>
      {/* floating help button */}
      <button
        data-tutorial="help-button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 md:bottom-5 md:right-5 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors hover:scale-105"
        aria-label="help"
        title="help & keyboard shortcuts"
      >
        <span className="text-lg font-bold">?</span>
      </button>

      {/* backdrop + drawer */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={`fixed inset-0 z-50 ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        onClick={handleBackdrop}
      >
        <div
          ref={drawerRef}
          className={`absolute top-0 right-0 h-full w-80 bg-card border-l border-border shadow-xl transition-transform duration-200 ease-out overflow-y-auto ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {/* header */}
          <div className="p-4 pb-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">help</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="close help"
            >
              ✕
            </button>
          </div>

          {/* sections */}
          {SECTIONS.map((section) => (
            <div key={section.title} className="p-4 pb-3 border-b border-border">
              <h3 className="text-xs font-medium text-muted-foreground mb-2">
                {section.title}
              </h3>
              <ul className="space-y-1.5">
                {section.items.map((item, i) => (
                  <li key={i} className="text-xs text-foreground leading-relaxed flex gap-2">
                    <span className="text-muted-foreground shrink-0">·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* actions */}
          <div className="p-4 space-y-2">
            <button
              onClick={handleReplayTour}
              className="w-full text-sm text-center py-2 rounded-md border border-border text-foreground hover:bg-muted transition-colors"
            >
              replay tour
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
