"use client";

import { useState } from "react";
import type { OpenResponseConfig, Participant } from "@/lib/types";

interface Props {
  config: OpenResponseConfig;
  role: "facilitator" | "participant";
  onSubmit?: (response: unknown) => void;
  responses?: Record<string, unknown>;
  participants?: Record<string, Participant>;
  submitted?: boolean;
}

export function OpenResponseActivity({
  config,
  role,
  onSubmit,
  responses,
  participants,
  submitted,
}: Props) {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit?.(text.trim());
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">{config.prompt}</h3>

      {role === "participant" && !submitted ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="share your thinking..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[var(--rh-cyan)] focus:border-transparent"
            autoFocus
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="w-full py-3 rounded-xl bg-[var(--rh-cyan)] text-white font-semibold hover:bg-[var(--rh-teal)] transition-colors disabled:opacity-30"
          >
            submit
          </button>
        </form>
      ) : role === "participant" && submitted ? (
        <div className="text-center py-6 text-[var(--rh-text-muted)]">
          <p className="text-2xl mb-2">✓</p>
          <p className="text-sm">response submitted</p>
        </div>
      ) : (
        /* facilitator: display wall */
        <div className="space-y-3 mt-2">
          {responses ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(responses).map(([pid, response]) => (
                <div
                  key={pid}
                  className="p-4 rounded-xl bg-white border border-black/5"
                >
                  {!config.anonymous && (
                    <p className="text-xs font-medium text-[var(--rh-text-muted)] mb-1.5">
                      {participants?.[pid]?.displayName || `participant ${Object.keys(responses).indexOf(pid) + 1}`}
                    </p>
                  )}
                  <p className="text-sm leading-relaxed">{String(response)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--rh-text-muted)]">
              responses will appear here when revealed
            </p>
          )}
        </div>
      )}
    </div>
  );
}
