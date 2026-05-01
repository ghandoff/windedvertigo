"use client";

/**
 * Play/pause, step, speed, and reset controls for the simulation.
 * Wraps gracefully at narrow viewports (< 640px).
 */

import type { SimSpeed, PoolAction } from "@/lib/types";

interface SimulationControlsProps {
  playing: boolean;
  speed: SimSpeed;
  tick: number;
  elementCount: number;
  connectionCount: number;
  dispatch: React.Dispatch<PoolAction>;
}

export function SimulationControls({
  playing,
  speed,
  tick,
  elementCount,
  connectionCount,
  dispatch,
}: SimulationControlsProps) {
  const canPlay = elementCount > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 rounded-xl border border-white/10">
      {/* Play / Pause */}
      <button
        onClick={() => dispatch({ type: playing ? "PAUSE" : "PLAY" })}
        disabled={!canPlay}
        className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--wv-redwood)] text-[var(--color-text-on-dark)] hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label={playing ? "Pause simulation" : "Play simulation"}
      >
        {playing ? "⏸" : "▶"}
      </button>

      {/* Step forward */}
      <button
        onClick={() => dispatch({ type: "TICK" })}
        disabled={playing || !canPlay}
        className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 text-[var(--color-text-on-dark)] hover:bg-white/15 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm"
        aria-label="Step forward one tick"
        title="Step forward"
      >
        ⏭
      </button>

      {/* Speed selector */}
      <div className="flex items-center gap-1">
        {([1, 2, 4] as SimSpeed[]).map((s) => (
          <button
            key={s}
            onClick={() => dispatch({ type: "SET_SPEED", speed: s })}
            className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
              speed === s
                ? "bg-[var(--wv-sienna)] text-[var(--color-text-on-dark)]"
                : "text-[var(--color-text-on-dark-muted)] hover:text-[var(--color-text-on-dark)]"
            }`}
            aria-label={`Set speed to ${s}x`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Reset — moved before stats so it stays on the first row on mobile */}
      <button
        onClick={() => {
          dispatch({ type: "PAUSE" });
          dispatch({ type: "RESET" });
        }}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--color-text-on-dark-muted)] hover:text-[var(--color-text-on-dark)] hover:bg-white/10 transition-all sm:ml-auto sm:order-last"
        aria-label="Reset pool"
      >
        reset
      </button>

      {/* Stats line — wraps to second row on mobile */}
      <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-[var(--color-text-on-dark-muted)] w-full sm:w-auto sm:ml-auto order-last sm:order-none">
        <span>tick {tick}</span>
        <span>{elementCount} el · {connectionCount} conn</span>
      </div>
    </div>
  );
}
