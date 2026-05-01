"use client";

import { useState } from "react";
import type { PollConfig, Participant } from "@/lib/types";

interface Props {
  config: PollConfig;
  role: "facilitator" | "participant";
  onSubmit?: (response: unknown) => void;
  responses?: Record<string, unknown>;
  participants?: Record<string, Participant>;
  submitted?: boolean;
}

export function PollActivity({
  config,
  role,
  onSubmit,
  responses,
  participants,
  submitted,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  // aggregate responses for facilitator view
  const tallies: Record<string, number> = {};
  if (responses) {
    for (const optionId of config.options.map((o) => o.id)) {
      tallies[optionId] = 0;
    }
    for (const response of Object.values(responses)) {
      const id = response as string;
      if (tallies[id] !== undefined) tallies[id]++;
    }
  }
  const totalVotes = Object.values(tallies).reduce((a, b) => a + b, 0);

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">{config.question}</h3>

      {role === "participant" && !submitted ? (
        <div className="space-y-2.5">
          {config.options.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelected(option.id)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${
                selected === option.id
                  ? "border-[var(--rh-cyan)] bg-[var(--rh-cyan)]/10 font-medium"
                  : "border-black/10 hover:border-[var(--rh-cyan)]/50"
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            onClick={() => {
              if (selected) onSubmit?.(selected);
            }}
            disabled={!selected}
            className="w-full py-3 rounded-xl bg-[var(--rh-cyan)] text-white font-semibold hover:bg-[var(--rh-teal)] transition-colors disabled:opacity-30 mt-1"
          >
            lock in my vote
          </button>
        </div>
      ) : role === "participant" && submitted ? (
        <div className="text-center py-6 text-[var(--rh-text-muted)]">
          <p className="text-2xl mb-2">✓</p>
          <p className="text-sm">response submitted — waiting for results</p>
        </div>
      ) : (
        /* facilitator view — show results */
        <div className="space-y-3">
          {config.options.map((option) => {
            const count = tallies[option.id] || 0;
            const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
            return (
              <div key={option.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{option.label}</span>
                  <span className="text-[var(--rh-text-muted)]">
                    {responses ? `${count} (${Math.round(pct)}%)` : "—"}
                  </span>
                </div>
                <div className="h-2 bg-black/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--rh-cyan)] rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {!responses && (
            <p className="text-xs text-[var(--rh-text-muted)] mt-2">
              results hidden — click &quot;reveal results&quot; to show
            </p>
          )}
        </div>
      )}
    </div>
  );
}
