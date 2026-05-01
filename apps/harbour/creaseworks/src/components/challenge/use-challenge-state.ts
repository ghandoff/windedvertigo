"use client";

/**
 * useChallengeState — state machine for Timer Challenge mode.
 *
 * Phases: config → active → celebration → results
 *
 * The challenge is about noticing, not speed. The timer adds
 * playfulness, but the celebration is always about what you
 * spotted, not how fast you were.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Material, MatcherResult } from "../matcher/types";
import { useTimer } from "./use-timer";
import { apiUrl } from "@/lib/api-url";

export type ChallengePhase = "config" | "active" | "celebration" | "results";

export interface ChallengeConfig {
  /** null = free play (no timer) */
  durationSeconds: number | null;
}

const DEFAULT_DURATION = 60;

export function useChallengeState(materials: Material[], slots: string[]) {
  const [phase, setPhase] = useState<ChallengePhase>("config");
  const [config, setConfig] = useState<ChallengeConfig>({
    durationSeconds: DEFAULT_DURATION,
  });
  const [found, setFound] = useState<Set<string>>(new Set());
  const [matcherResults, setMatcherResults] = useState<MatcherResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  /* timer — only ticks when durationSeconds is non-null */
  const handleExpire = useCallback(() => {
    setPhase("celebration");
  }, []);

  const timer = useTimer(
    config.durationSeconds ?? DEFAULT_DURATION,
    handleExpire,
  );

  /** ref to the latest timer — avoids stale closures in callbacks */
  const timerRef = useRef(timer);
  useEffect(() => { timerRef.current = timer; }, [timer]);

  /* ── actions ────────────────────────────────────────────────── */

  const startChallenge = useCallback(
    (cfg: ChallengeConfig) => {
      setConfig(cfg);
      setFound(new Set());
      setMatcherResults(null);
      setError(null);
      setPhase("active");

      if (cfg.durationSeconds !== null) {
        timerRef.current.reset();
        // delay ensures state flush so timer reads the new duration
        setTimeout(() => timerRef.current.start(), 50);
      }
    },
    [],
  );

  const tapItem = useCallback((id: string) => {
    setFound((prev) => {
      if (prev.has(id)) return prev; // no deselect during challenge
      return new Set(prev).add(id);
    });
  }, []);

  /** end the challenge early (free play mode or "i'm done!" button) */
  const finishEarly = useCallback(() => {
    timer.reset();
    setPhase("celebration");
  }, [timer]);

  /** submit found items to matcher API */
  const submitToMatcher = useCallback(async () => {
    if (found.size === 0) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl("/api/matcher"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materials: Array.from(found).filter(
            (id) => !slots.includes(id), // separate materials from slots
          ),
          forms: [],
          slots: Array.from(found).filter((id) => slots.includes(id)),
          contexts: [],
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `request failed (${res.status})`);
      }

      const data: MatcherResult = await res.json();
      setMatcherResults(data);
      setPhase("results");

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      setError(err.message || "something went wrong");
    } finally {
      setLoading(false);
    }
  }, [found, slots]);

  const reset = useCallback(() => {
    timer.reset();
    setPhase("config");
    setFound(new Set());
    setMatcherResults(null);
    setError(null);
    setConfig({ durationSeconds: DEFAULT_DURATION });
  }, [timer]);

  return {
    phase,
    config,
    found,
    matcherResults,
    loading,
    error,
    resultsRef,
    timer,
    startChallenge,
    tapItem,
    finishEarly,
    submitToMatcher,
    reset,
  };
}
