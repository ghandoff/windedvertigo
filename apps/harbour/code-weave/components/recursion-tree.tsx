"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface NodeState {
  label: string;
  n: number;
  visible: boolean;
  active: boolean;
  resolved: boolean;
  returnValue: number | null;
}

function initialNodes(): NodeState[] {
  return [5, 4, 3, 2, 1, 0].map((n) => ({
    label: `fact(${n})`,
    n,
    visible: false,
    active: false,
    resolved: false,
    returnValue: null,
  }));
}

// steps: 0=fact(5) appears, 1=fact(4), ..., 5=fact(0),
// 6=fact(0) resolves=1, 7=fact(1)=1, 8=fact(2)=2, 9=fact(3)=6, 10=fact(4)=24, 11=fact(5)=120
const TOTAL_STEPS = 12;

function computeStep(step: number): NodeState[] {
  const nodes = initialNodes();
  // show nodes for steps 0..5
  for (let i = 0; i <= Math.min(step, 5); i++) {
    nodes[i].visible = true;
  }
  // active node during descent
  if (step <= 5) {
    nodes[step].active = true;
  }
  // resolve phase: step 6 resolves index 5 (fact(0)), step 7 resolves index 4 (fact(1)), etc.
  if (step >= 6) {
    const resolveIndex = 5 - (step - 6); // 5,4,3,2,1,0
    const factorials = [120, 24, 6, 2, 1, 1]; // fact(5)..fact(0)
    for (let i = 5; i >= resolveIndex; i--) {
      nodes[i].resolved = true;
      nodes[i].returnValue = factorials[i];
    }
    nodes[resolveIndex].active = true;
  }
  return nodes;
}

export default function RecursionTree() {
  const [step, setStep] = useState(-1);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);

  const nodes = step < 0 ? initialNodes() : computeStep(step);

  const advance = useCallback(() => {
    setStep((s) => {
      if (s >= TOTAL_STEPS - 1) return s;
      return s + 1;
    });
  }, []);

  const reset = () => {
    setAutoPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setStep(-1);
  };

  const toggleAutoPlay = () => {
    if (autoPlaying) {
      setAutoPlaying(false);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      setAutoPlaying(true);
      advance();
      timerRef.current = window.setInterval(() => {
        setStep((s) => {
          if (s >= TOTAL_STEPS - 1) {
            setAutoPlaying(false);
            if (timerRef.current) clearInterval(timerRef.current);
            return s;
          }
          return s + 1;
        });
      }, 500);
    }
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const done = step >= TOTAL_STEPS - 1;

  return (
    <div>
      {/* tree */}
      <div className="flex flex-col items-center gap-1 mb-8">
        {nodes.map((node, i) => (
          <div key={i} className="flex flex-col items-center">
            {i > 0 && node.visible && (
              <div
                className="w-px h-6 transition-colors"
                style={{
                  background: node.resolved
                    ? "var(--wv-champagne)"
                    : "rgba(255,255,255,0.15)",
                }}
              />
            )}
            {node.visible && (
              <div
                className="px-4 py-2 rounded-lg border text-sm font-mono transition-all duration-300 flex items-center gap-2"
                style={{
                  background: node.active
                    ? "var(--wv-champagne)"
                    : node.resolved
                    ? "rgba(255,255,255,0.08)"
                    : "var(--color-surface-raised)",
                  borderColor: node.active
                    ? "var(--wv-champagne)"
                    : "rgba(255,255,255,0.1)",
                  color: node.active ? "var(--wv-cadet)" : "inherit",
                  boxShadow: node.active ? "0 0 12px var(--wv-champagne)" : "none",
                }}
              >
                <span>{node.label}</span>
                {node.resolved && node.returnValue !== null && (
                  <span
                    className="font-semibold"
                    style={{
                      color: node.active ? "var(--wv-cadet)" : "var(--wv-champagne)",
                    }}
                  >
                    = {node.returnValue}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
        {step < 0 && (
          <p className="text-sm text-[var(--color-text-on-dark-muted)] mt-4 italic">
            press step or auto-play to begin
          </p>
        )}
      </div>

      {/* step description */}
      {step >= 0 && (
        <div
          className="rounded-xl border px-4 py-3 mb-6 text-sm text-center"
          style={{
            background: "rgba(255,255,255,0.05)",
            borderColor: "rgba(255,255,255,0.1)",
          }}
        >
          {step <= 5 && (
            <span className="text-[var(--color-text-on-dark-muted)]">
              fact({5 - step}) calls fact({4 - step >= 0 ? 4 - step : "..."})
              {step === 5 && " — base case reached"}
            </span>
          )}
          {step > 5 && (
            <span className="text-[var(--color-text-on-dark-muted)]">
              {(() => {
                const n = step - 6; // 0..5 mapping to fact(0)..fact(5)
                const vals = [1, 1, 2, 6, 24, 120];
                const expressions = [
                  "fact(0) returns 1",
                  "fact(1) returns 1 × 1 = 1",
                  "fact(2) returns 2 × 1 = 2",
                  "fact(3) returns 3 × 2 = 6",
                  "fact(4) returns 4 × 6 = 24",
                  "fact(5) returns 5 × 24 = 120",
                ];
                return expressions[n] ?? `resolved: ${vals[n]}`;
              })()}
            </span>
          )}
        </div>
      )}

      {/* controls */}
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={advance}
          disabled={done || autoPlaying}
          className="px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-30"
          style={{
            background: "var(--wv-sienna)",
            color: "var(--wv-champagne)",
          }}
        >
          step
        </button>
        <button
          onClick={toggleAutoPlay}
          disabled={done}
          className="px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-30"
          style={{
            background: autoPlaying ? "var(--wv-redwood)" : "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {autoPlaying ? "pause" : "auto-play"}
        </button>
        <button
          onClick={reset}
          className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: "var(--color-surface-raised)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          reset
        </button>
      </div>

      {/* explanation */}
      {done && (
        <div
          className="mt-6 rounded-xl border px-5 py-4 text-sm leading-relaxed"
          style={{
            background: "rgba(255,255,255,0.03)",
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <p className="text-[var(--color-text-on-dark-muted)]">
            recursion is a function calling itself with a smaller problem. the
            &ldquo;magic&rdquo; is that each call waits for the next to finish before it
            can return. once you see this pattern, you&apos;ll recognise it everywhere.
          </p>
        </div>
      )}
    </div>
  );
}
