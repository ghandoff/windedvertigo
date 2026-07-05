"use client";

/**
 * @windedvertigo/motion-kit — MotionGate
 *
 * useMotionGate() — returns { shouldAnimate: boolean }
 *
 * shouldAnimate is false when ANY of these are true:
 *   1. OS prefers-reduced-motion
 *   2. html.classList has 'reduce-motion'  (creaseworks in-app toggle)
 *   3. html.classList has 'calm-theme'     (sensory sensitivity mode)
 *   4. html.dataset.still exists           (wv-site AnimationProvider kill switch)
 *
 * The hook observes all signals reactively — class changes, data-attribute changes,
 * and matchMedia — so it responds to live changes without a reload.
 *
 * Usage:
 *   const { shouldAnimate } = useMotionGate();
 *   if (!shouldAnimate) return <StaticFallback />;
 */

import { createContext, useContext, useEffect, useState } from "react";

interface MotionGateValue {
  shouldAnimate: boolean;
}

const MotionGateContext = createContext<MotionGateValue>({ shouldAnimate: true });

function getGateState(): boolean {
  if (typeof window === "undefined") return false; // SSR: stay still until hydrated
  const html = document.documentElement;
  const osReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const appReduced = html.classList.contains("reduce-motion");  // creaseworks toggle
  const calmTheme  = html.classList.contains("calm-theme");     // creaseworks sensory
  const siteStill  = "still" in html.dataset;                   // wv-site kill switch
  return !osReduced && !appReduced && !calmTheme && !siteStill;
}

export function MotionGateProvider({ children }: { children: React.ReactNode }) {
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    setShouldAnimate(getGateState());

    // Respond to OS preference changes (e.g. user flips system setting mid-session)
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMqChange = () => setShouldAnimate(getGateState());
    mq.addEventListener("change", onMqChange);

    // Respond to html class changes (creaseworks calm-theme / reduce-motion toggles)
    const observer = new MutationObserver(() => setShouldAnimate(getGateState()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-still"],
    });

    return () => {
      mq.removeEventListener("change", onMqChange);
      observer.disconnect();
    };
  }, []);

  return (
    <MotionGateContext.Provider value={{ shouldAnimate }}>
      {children}
    </MotionGateContext.Provider>
  );
}

export function useMotionGate(): MotionGateValue {
  return useContext(MotionGateContext);
}

/**
 * Lightweight version — no context, no provider required.
 * Use in one-off components that aren't inside a MotionGateProvider.
 * Re-reads on every render; observers are set up per-instance.
 */
export function useMotionGateStandalone(): MotionGateValue {
  const [shouldAnimate, setShouldAnimate] = useState(getGateState);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setShouldAnimate(getGateState());
    mq.addEventListener("change", update);

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-still"],
    });

    return () => {
      mq.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  return { shouldAnimate };
}
