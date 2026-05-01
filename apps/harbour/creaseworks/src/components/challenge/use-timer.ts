"use client";

/**
 * useTimer — drift-corrected countdown hook.
 *
 * Uses Date.now() anchoring instead of naive setInterval to survive
 * mobile tab backgrounding. The number shown is always wall-clock
 * accurate when the kid returns to the tab.
 */

import { useState, useRef, useCallback, useEffect } from "react";

interface UseTimerReturn {
  /** seconds remaining (clamped to 0) */
  timeLeft: number;
  /** true while counting down */
  isRunning: boolean;
  /** start the countdown */
  start: () => void;
  /** reset to initial duration */
  reset: () => void;
}

export function useTimer(
  durationSeconds: number,
  onExpire: () => void,
): UseTimerReturn {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [isRunning, setIsRunning] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const onExpireRef = useRef(onExpire);

  /* keep onExpire ref fresh — must be in an effect, not during render */
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  /* drive the countdown with a polling interval while running */
  useEffect(() => {
    if (!isRunning || startedAtRef.current === null) return;

    const id = setInterval(() => {
      const elapsed = (Date.now() - (startedAtRef.current ?? Date.now())) / 1000;
      const remaining = Math.max(0, durationSeconds - Math.floor(elapsed));

      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(id);
        setIsRunning(false);
        startedAtRef.current = null;
        onExpireRef.current();
      }
    }, 250);

    return () => clearInterval(id);
  }, [isRunning, durationSeconds]);

  const start = useCallback(() => {
    startedAtRef.current = Date.now();
    setTimeLeft(durationSeconds);
    setIsRunning(true);
  }, [durationSeconds]);

  const reset = useCallback(() => {
    startedAtRef.current = null;
    setIsRunning(false);
    setTimeLeft(durationSeconds);
  }, [durationSeconds]);

  return { timeLeft, isRunning, start, reset };
}
