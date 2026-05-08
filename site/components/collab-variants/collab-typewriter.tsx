"use client";
import { useEffect, useRef, useState } from "react";
import { COLLABORATORS } from "@/lib/collaborators";

/**
 * #2 — Typewriter Roll
 *
 * A single full-width line types through every collaborator name, one
 * character at a time, with a blinking cursor. Current partners render
 * in champagne; past ones in dim white. Loops forever.
 *
 * UDL: prefers-reduced-motion collapses to a static marquee-free list.
 */

const NAMES = COLLABORATORS.map((c) => ({ name: c.name, current: c.current }));
const TYPE_MS = 60;   // ms per character typed
const DELETE_MS = 30; // ms per character deleted
const PAUSE_MS = 1400; // pause when fully typed

type Phase = "typing" | "pausing" | "deleting";

export function CollabTypewriter() {
  const [nameIdx, setNameIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reducedMotion || paused) return;

    const target = NAMES[nameIdx].name;

    if (phase === "typing") {
      if (displayed.length < target.length) {
        timerRef.current = setTimeout(() => {
          setDisplayed(target.slice(0, displayed.length + 1));
        }, TYPE_MS);
      } else {
        timerRef.current = setTimeout(() => setPhase("pausing"), PAUSE_MS);
      }
    } else if (phase === "pausing") {
      timerRef.current = setTimeout(() => setPhase("deleting"), 0);
    } else if (phase === "deleting") {
      if (displayed.length > 0) {
        timerRef.current = setTimeout(() => {
          setDisplayed(displayed.slice(0, -1));
        }, DELETE_MS);
      } else {
        setNameIdx((i) => (i + 1) % NAMES.length);
        setPhase("typing");
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [displayed, phase, nameIdx, reducedMotion, paused]);

  const isCurrent = NAMES[nameIdx].current;

  if (reducedMotion) {
    return (
      <section className="collab-variant collab-typewriter collab-typewriter--static" aria-label="organisations we play with">
        <p className="collab-variant-label">organisations we play with</p>
        <ul className="collab-typewriter-static-list">
          {NAMES.map((n) => (
            <li key={n.name} className={n.current ? "tw-current" : "tw-past"}>
              {n.name}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="collab-variant collab-typewriter" aria-label="organisations we play with" aria-live="polite" aria-atomic="true">
      <p className="collab-variant-label">organisations we play with</p>
      <div className="tw-controls">
        <button
          className={`tw-pause-btn${paused ? " tw-pause-btn--paused" : ""}`}
          onClick={() => setPaused(p => !p)}
          aria-label={paused ? "resume animation" : "pause animation"}
          aria-pressed={paused}
        >
          {paused ? "▶ resume" : "⏸ pause"}
        </button>
      </div>
      <div className="collab-typewriter-stage">
        <span
          className={`collab-typewriter-text ${isCurrent ? "tw-current" : "tw-past"}`}
          aria-label={NAMES[nameIdx].name}
        >
          {displayed}
        </span>
        <span className="collab-typewriter-cursor" aria-hidden="true">|</span>
      </div>
    </section>
  );
}
