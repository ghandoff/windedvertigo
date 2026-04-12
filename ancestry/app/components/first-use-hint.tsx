"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useTutorial } from "./tutorial-provider";

type FirstUseHintProps = {
  hintKey: string;
  message: string;
  position?: "top" | "bottom" | "left" | "right";
  /** delay in ms before showing (default 1500) */
  delay?: number;
  children: ReactNode;
};

const positionClasses: Record<string, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

export function FirstUseHint({
  hintKey,
  message,
  position = "bottom",
  delay = 1500,
  children,
}: FirstUseHintProps) {
  const { hasSeenHint, markHintShown, state } = useTutorial();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // don't show hints during or before the main tour
    if (!state.tourComplete) return;
    if (hasSeenHint(hintKey)) return;

    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [hintKey, hasSeenHint, state.tourComplete, delay]);

  const dismiss = () => {
    setVisible(false);
    markHintShown(hintKey);
  };

  return (
    <div className="relative inline-block">
      {children}
      {visible && (
        <div
          className={`absolute z-50 ${positionClasses[position]} animate-in fade-in-0 slide-in-from-bottom-2 duration-300`}
        >
          <div className="rounded-md bg-card border border-border shadow-lg px-3 py-2 max-w-[220px]">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {message}
            </p>
            <button
              onClick={dismiss}
              className="mt-1.5 text-[10px] text-primary hover:text-primary/80 font-medium transition-colors"
            >
              got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
