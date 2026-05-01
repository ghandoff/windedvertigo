"use client";

import { useState } from "react";

const RATE_A = 50;
const RATE_B = 20;
const TOTAL_HOURS = 100;

export default function OpportunitySlider() {
  const [hoursA, setHoursA] = useState(50);
  const hoursB = TOTAL_HOURS - hoursA;

  const earningsA = hoursA * RATE_A;
  const earningsB = hoursB * RATE_B;
  const total = earningsA + earningsB;

  const ghostA = (TOTAL_HOURS - hoursA) * RATE_A; // what you give up from A
  const ghostB = (TOTAL_HOURS - hoursB) * RATE_B; // what you give up from B

  const maxEarnings = TOTAL_HOURS * RATE_A; // theoretical max for bar scaling

  return (
    <div className="space-y-8">
      {/* project A */}
      <div>
        <div className="flex justify-between items-baseline mb-2">
          <label htmlFor="slider-a" className="text-sm font-semibold">
            project A — {hoursA} hours
          </label>
          <span className="text-sm text-[var(--color-text-on-dark-muted)]">
            £{RATE_A}/hr (boring but pays well)
          </span>
        </div>
        <input
          id="slider-a"
          type="range"
          min={0}
          max={100}
          value={hoursA}
          onChange={(e) => setHoursA(Number(e.target.value))}
          className="w-full accent-[var(--wv-sienna)]"
          style={{ touchAction: "none" }}
        />
        {/* earnings bar */}
        <div className="mt-2 relative h-8 rounded-lg overflow-hidden" style={{ background: "var(--color-surface-raised)" }}>
          <div
            className="h-full rounded-lg transition-all duration-150 flex items-center px-3"
            style={{
              width: `${(earningsA / maxEarnings) * 100}%`,
              background: "var(--wv-sienna)",
              minWidth: earningsA > 0 ? "60px" : "0",
            }}
          >
            {earningsA > 0 && (
              <span className="text-xs font-semibold" style={{ color: "var(--wv-champagne)" }}>
                £{earningsA.toLocaleString()}
              </span>
            )}
          </div>
          {/* ghost overlay */}
          {ghostA > 0 && (
            <div
              className="absolute top-0 right-0 h-full flex items-center justify-end px-3 pointer-events-none"
              style={{
                width: `${(ghostA / maxEarnings) * 100}%`,
                background: "rgba(255,255,255,0.04)",
                borderLeft: "1px dashed rgba(255,255,255,0.15)",
              }}
            >
              <span className="text-xs text-[var(--color-text-on-dark-muted)] italic">
                −£{ghostA.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* project B */}
      <div>
        <div className="flex justify-between items-baseline mb-2">
          <label htmlFor="slider-b" className="text-sm font-semibold">
            project B — {hoursB} hours
          </label>
          <span className="text-sm text-[var(--color-text-on-dark-muted)]">
            £{RATE_B}/hr (teaches new skill)
          </span>
        </div>
        <input
          id="slider-b"
          type="range"
          min={0}
          max={100}
          value={hoursB}
          onChange={(e) => setHoursA(TOTAL_HOURS - Number(e.target.value))}
          className="w-full accent-[var(--wv-sienna)]"
          style={{ touchAction: "none" }}
        />
        {/* earnings bar */}
        <div className="mt-2 relative h-8 rounded-lg overflow-hidden" style={{ background: "var(--color-surface-raised)" }}>
          <div
            className="h-full rounded-lg transition-all duration-150 flex items-center px-3"
            style={{
              width: `${(earningsB / maxEarnings) * 100}%`,
              background: "var(--wv-champagne)",
              minWidth: earningsB > 0 ? "60px" : "0",
            }}
          >
            {earningsB > 0 && (
              <span className="text-xs font-semibold" style={{ color: "var(--wv-cadet)" }}>
                £{earningsB.toLocaleString()}
              </span>
            )}
          </div>
          {/* ghost overlay */}
          {ghostB > 0 && (
            <div
              className="absolute top-0 right-0 h-full flex items-center justify-end px-3 pointer-events-none"
              style={{
                width: `${(ghostB / maxEarnings) * 100}%`,
                background: "rgba(255,255,255,0.04)",
                borderLeft: "1px dashed rgba(255,255,255,0.15)",
              }}
            >
              <span className="text-xs text-[var(--color-text-on-dark-muted)] italic">
                −£{ghostB.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* totals */}
      <div
        className="rounded-xl border px-5 py-4 text-center"
        style={{
          background: "rgba(255,255,255,0.05)",
          borderColor: "rgba(255,255,255,0.1)",
        }}
      >
        <p className="text-2xl font-bold mb-1" style={{ color: "var(--wv-champagne)" }}>
          £{total.toLocaleString()}
        </p>
        <p className="text-xs text-[var(--color-text-on-dark-muted)]">
          combined monthly earnings
        </p>
      </div>

      {/* ghost explanation */}
      <div
        className="rounded-xl border px-5 py-4 text-sm leading-relaxed"
        style={{
          background: "rgba(255,255,255,0.03)",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <p className="text-[var(--color-text-on-dark-muted)]">
          {hoursA > 0 && hoursB > 0 ? (
            <>
              you&apos;re giving up{" "}
              <strong style={{ color: "var(--wv-champagne)" }}>
                £{ghostA.toLocaleString()}
              </strong>{" "}
              from project A and{" "}
              <strong style={{ color: "var(--wv-champagne)" }}>
                £{ghostB.toLocaleString()}
              </strong>{" "}
              from project B.
            </>
          ) : hoursA === TOTAL_HOURS ? (
            <>
              you&apos;re giving up all{" "}
              <strong style={{ color: "var(--wv-champagne)" }}>
                £{(TOTAL_HOURS * RATE_B).toLocaleString()}
              </strong>{" "}
              from project B — and the new skill it teaches.
            </>
          ) : (
            <>
              you&apos;re giving up all{" "}
              <strong style={{ color: "var(--wv-champagne)" }}>
                £{(TOTAL_HOURS * RATE_A).toLocaleString()}
              </strong>{" "}
              from project A — that&apos;s a lot of money to leave on the table.
            </>
          )}
        </p>
        <p className="mt-3 text-[var(--color-text-on-dark-muted)]">
          the ghost numbers are your opportunity cost — the value of what you&apos;re not
          choosing. every yes is a thousand nos.
        </p>
      </div>
    </div>
  );
}
