"use client";

import { useState } from "react";

interface ScaleLevel {
  power: number;
  label: string;
  description: string;
}

const SCALES: ScaleLevel[] = [
  { power: -10, label: "atom", description: "0.1 nanometre" },
  { power: -9, label: "molecule", description: "1 nanometre" },
  { power: -6, label: "bacterium", description: "1 micrometre" },
  { power: -4, label: "human hair width", description: "100 micrometres" },
  { power: -3, label: "grain of sand", description: "1 millimetre" },
  { power: -2, label: "coin", description: "1 centimetre" },
  { power: 0, label: "human", description: "1 metre" },
  { power: 1, label: "house", description: "10 metres" },
  { power: 3, label: "mountain", description: "1 kilometre" },
  { power: 6, label: "earth diameter", description: "~12,700 km" },
  { power: 9, label: "sun diameter", description: "~1.4 million km" },
  { power: 13, label: "solar system", description: "~100 AU" },
  { power: 16, label: "light year", description: "~9.46 trillion km" },
  { power: 21, label: "milky way diameter", description: "~100,000 light years" },
  { power: 26, label: "observable universe", description: "~93 billion light years" },
];

const MIN_POWER = -10;
const MAX_POWER = 26;

function formatPower(p: number): string {
  return `10${p < 0 ? "\u207B" : ""}${Math.abs(p)
    .toString()
    .split("")
    .map((d) => String.fromCharCode(0x2070 + parseInt(d)))
    .join("")}`;
}

function getCircleSize(power: number): number {
  // map power from [-10, 26] to [8, 200] px
  const t = (power - MIN_POWER) / (MAX_POWER - MIN_POWER);
  return 8 + t * 192;
}

function findNearest(power: number): ScaleLevel | null {
  let best: ScaleLevel | null = null;
  let bestDist = Infinity;
  for (const s of SCALES) {
    const d = Math.abs(s.power - power);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return bestDist <= 1.5 ? best : null;
}

export default function ScaleExplorer() {
  const [power, setPower] = useState(0);
  const nearest = findNearest(power);
  const circleSize = getCircleSize(power);

  return (
    <div className="w-full">
      {/* current scale display */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 sm:p-12 flex flex-col items-center justify-center min-h-[320px] relative overflow-hidden">
        {/* scale indicator */}
        <p className="text-4xl sm:text-5xl font-bold tracking-tight text-[var(--wv-champagne)] mb-2 z-10">
          {formatPower(power)}
        </p>
        <p className="text-lg text-[var(--color-text-on-dark-muted)] mb-8 z-10">
          {formatPower(power)} metres
        </p>

        {/* representative circle */}
        <div
          className="rounded-full border-2 border-[var(--wv-champagne)] transition-all duration-500 ease-out flex items-center justify-center z-10"
          style={{
            width: `${circleSize}px`,
            height: `${circleSize}px`,
            backgroundColor: "var(--wv-champagne)",
            opacity: 0.15,
            borderColor: "var(--wv-champagne)",
          }}
        />

        {/* label */}
        <div className="mt-6 text-center z-10 min-h-[48px]">
          {nearest ? (
            <>
              <p className="text-xl font-semibold text-[var(--wv-champagne)]">{nearest.label}</p>
              <p className="text-sm text-[var(--color-text-on-dark-muted)]">{nearest.description}</p>
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-on-dark-muted)] italic">
              between known scales...
            </p>
          )}
        </div>
      </div>

      {/* slider */}
      <div className="mt-6 px-2">
        <input
          type="range"
          min={MIN_POWER}
          max={MAX_POWER}
          step={1}
          value={power}
          onChange={(e) => setPower(parseInt(e.target.value))}
          className="w-full accent-[var(--wv-sienna)]"
          aria-label="scale power selector"
        />
        <div className="flex justify-between text-xs text-[var(--color-text-on-dark-muted)] mt-1">
          <span>atoms</span>
          <span>human scale</span>
          <span>observable universe</span>
        </div>
      </div>

      {/* scale markers */}
      <div className="mt-8 space-y-1">
        {SCALES.map((s) => {
          const isActive = nearest?.power === s.power;
          return (
            <button
              key={s.power}
              onClick={() => setPower(s.power)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-3 ${
                isActive
                  ? "bg-[var(--wv-champagne)]/10 border border-[var(--wv-champagne)]/20"
                  : "border border-transparent hover:bg-white/5"
              }`}
            >
              <span
                className={`text-sm font-mono w-12 ${
                  isActive ? "text-[var(--wv-champagne)]" : "text-[var(--color-text-on-dark-muted)]"
                }`}
              >
                {formatPower(s.power)}
              </span>
              <span
                className={`text-sm ${
                  isActive ? "text-[var(--wv-champagne)]" : "text-[var(--color-text-on-dark-muted)]"
                }`}
              >
                {s.label}
              </span>
              <span className="text-xs text-[var(--color-text-on-dark-muted)] ml-auto hidden sm:inline">
                {s.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
