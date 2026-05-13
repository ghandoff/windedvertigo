"use client";

/**
 * Global animation kill switch.
 *
 * Provides a React context that components can subscribe to. When `paused`
 * is true, all kinetic animations sitewide should stop. The state persists
 * via localStorage (key: "wv-animations-paused") and is synced to the HTML
 * root attribute `data-still`, which the CSS layer uses to pause all
 * CSS keyframe animations at once without needing individual component hooks.
 *
 * SSR-safe: localStorage and document access are guarded inside useEffect.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

const LS_KEY = "wv-animations-paused";

interface AnimationCtx {
  paused: boolean;
  toggle: () => void;
}

const Ctx = createContext<AnimationCtx>({ paused: false, toggle: () => {} });

export function AnimationProvider({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false);

  // On mount: read localStorage and sync `data-still` attribute
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY) === "1";
    if (stored) {
      setPaused(true);
      document.documentElement.dataset.still = "";
    }
  }, []);

  const toggle = useCallback(() => {
    setPaused((prev) => {
      const next = !prev;
      localStorage.setItem(LS_KEY, next ? "1" : "0");
      if (next) {
        document.documentElement.dataset.still = "";
      } else {
        delete document.documentElement.dataset.still;
      }
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ paused, toggle }}>{children}</Ctx.Provider>;
}

/** Subscribe to the global animation pause state. */
export function useAnimations(): AnimationCtx {
  return useContext(Ctx);
}
