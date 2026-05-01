"use client";

import { useState } from "react";
import type { PredictionConfig, Participant } from "@/lib/types";

interface Props {
  config: PredictionConfig;
  role: "facilitator" | "participant";
  onSubmit?: (response: unknown) => void;
  responses?: Record<string, unknown>;
  participants?: Record<string, Participant>;
  submitted?: boolean;
}

export function PredictionActivity({
  config,
  role,
  onSubmit,
  responses,
  participants,
  submitted,
}: Props) {
  const [value, setValue] = useState("");
  const [choiceSelected, setChoiceSelected] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (config.type === "choice") {
      if (!choiceSelected) return;
      onSubmit?.(choiceSelected);
    } else {
      if (!value.trim()) return;
      const parsed = config.type === "number" ? Number(value) : value.trim();
      onSubmit?.(parsed);
    }
  };

  // compute stats for number predictions (copy before sorting to avoid mutation)
  const numericResponses = responses
    ? Object.values(responses).filter((r): r is number => typeof r === "number")
    : [];
  const avg =
    numericResponses.length > 0
      ? numericResponses.reduce((a, b) => a + b, 0) / numericResponses.length
      : null;
  const median = (() => {
    if (numericResponses.length === 0) return null;
    const sorted = [...numericResponses].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  })();

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">{config.question}</h3>

      {role === "participant" && !submitted ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          {config.type === "choice" && config.options ? (
            /* choice prediction — select-then-confirm */
            <>
              <div className="space-y-2">
                {config.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setChoiceSelected(option.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${
                      choiceSelected === option.id
                        ? "border-[var(--rh-cyan)] bg-[var(--rh-cyan)]/10 font-medium"
                        : "border-black/10 hover:border-[var(--rh-cyan)]/50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={!choiceSelected}
                className="w-full py-3 rounded-xl bg-[var(--rh-cyan)] text-white font-semibold hover:bg-[var(--rh-teal)] transition-colors disabled:opacity-30"
              >
                lock in my prediction
              </button>
            </>
          ) : (
            /* text or number prediction */
            <>
              <div className="flex gap-2 items-center">
                <input
                  type={config.type === "number" ? "number" : "text"}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={config.type === "number" ? "your estimate" : "your prediction"}
                  className="flex-1 px-4 py-3 rounded-xl border border-black/10 bg-white text-lg focus:outline-none focus:ring-2 focus:ring-[var(--rh-cyan)] focus:border-transparent"
                  autoFocus
                />
                {config.unit && (
                  <span className="text-lg text-[var(--rh-text-muted)] font-medium">
                    {config.unit}
                  </span>
                )}
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[var(--rh-cyan)] text-white font-semibold hover:bg-[var(--rh-teal)] transition-colors"
              >
                lock in my prediction
              </button>
            </>
          )}
        </form>
      ) : role === "participant" && submitted ? (
        <div className="text-center py-6 text-[var(--rh-text-muted)]">
          <p className="text-2xl mb-2">🔒</p>
          <p className="text-sm">prediction locked — waiting for reveal</p>
        </div>
      ) : (
        /* facilitator view */
        <div className="space-y-4">
          {responses ? (
            <>
              {/* the reveal */}
              {config.answer !== undefined && (
                <div className="p-4 rounded-xl bg-[var(--rh-teal)] text-white text-center">
                  <p className="text-xs uppercase tracking-wider opacity-70 mb-1">
                    the answer
                  </p>
                  <p className="text-3xl font-bold">
                    {config.type === "choice" && config.options
                      ? config.options.find((o) => o.id === config.answer)?.label || String(config.answer)
                      : <>{typeof config.answer === "number" ? config.answer.toLocaleString() : config.answer}{config.unit ? ` ${config.unit}` : ""}</>}
                  </p>
                </div>
              )}

              {/* prediction distribution — number stats */}
              {config.type === "number" && numericResponses.length > 0 && (
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-black/5">
                    <p className="text-xs text-[var(--rh-text-muted)]">average</p>
                    <p className="text-lg font-semibold">
                      {avg?.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-black/5">
                    <p className="text-xs text-[var(--rh-text-muted)]">median</p>
                    <p className="text-lg font-semibold">
                      {median?.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </p>
                  </div>
                </div>
              )}

              {/* choice distribution — bar chart like poll */}
              {config.type === "choice" && config.options && (() => {
                const tallies: Record<string, number> = {};
                for (const opt of config.options) tallies[opt.id] = 0;
                for (const r of Object.values(responses)) {
                  const id = r as string;
                  if (tallies[id] !== undefined) tallies[id]++;
                }
                const total = Object.values(tallies).reduce((a, b) => a + b, 0);
                return (
                  <div className="space-y-3">
                    {config.options.map((option) => {
                      const count = tallies[option.id] || 0;
                      const pct = total > 0 ? (count / total) * 100 : 0;
                      const isAnswer = config.answer === option.id;
                      return (
                        <div key={option.id}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className={isAnswer ? "font-semibold text-[var(--rh-teal)]" : ""}>
                              {isAnswer && "✓ "}{option.label}
                            </span>
                            <span className="text-[var(--rh-text-muted)]">
                              {count} ({Math.round(pct)}%)
                            </span>
                          </div>
                          <div className="h-2 bg-black/5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isAnswer ? "bg-[var(--rh-teal)]" : "bg-[var(--rh-cyan)]"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* individual responses */}
              <div className="space-y-1.5">
                {Object.entries(responses).map(([pid, response]) => (
                  <div
                    key={pid}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/5 text-sm"
                  >
                    <span className="text-[var(--rh-text-muted)] flex-1 truncate">
                      {participants?.[pid]?.displayName || `participant ${Object.keys(responses).indexOf(pid) + 1}`}
                    </span>
                    <span className="font-medium">
                      {config.type === "choice" && config.options
                        ? config.options.find((o) => o.id === response)?.label || String(response)
                        : <>{typeof response === "number" ? response.toLocaleString() : String(response)}{config.unit ? ` ${config.unit}` : ""}</>}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--rh-text-muted)]">
              predictions are hidden — click &quot;reveal results&quot; to show
              the answer and all predictions
            </p>
          )}
        </div>
      )}
    </div>
  );
}
