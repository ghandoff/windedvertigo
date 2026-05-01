"use client";

import { useState } from "react";
import type { ReflectionConfig, Participant } from "@/lib/types";
import { useAgeLevel } from "@/lib/age-context";

interface Props {
  config: ReflectionConfig;
  role: "facilitator" | "participant";
  onSubmit?: (response: unknown) => void;
  responses?: Record<string, unknown>;
  participants?: Record<string, Participant>;
  submitted?: boolean;
}

export function ReflectionActivity({
  config,
  role,
  onSubmit,
  responses,
  participants,
  submitted,
}: Props) {
  const ageLevel = useAgeLevel();
  const [text, setText] = useState("");
  const charCount = text.length;
  // at kids level, remove minimum length requirement
  const effectiveMinLength = ageLevel === "kids" ? 0 : config.minLength;
  const meetsMinimum = !effectiveMinLength || charCount >= effectiveMinLength;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetsMinimum) return;
    onSubmit?.(text.trim());
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-1">{config.prompt}</h3>
      {config.shareWithGroup && (
        <p className="text-xs text-[var(--rh-text-muted)] mb-4">
          your reflection will be shared with the group
        </p>
      )}

      {role === "participant" && !submitted ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              ageLevel === "kids"
                ? "what do you think? there are no wrong answers!"
                : "take your time. write what shifted for you..."
            }
            rows={ageLevel === "kids" ? 3 : 5}
            className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[var(--rh-cyan)] focus:border-transparent"
            autoFocus
          />
          <div className="flex items-center justify-between">
            {ageLevel === "kids" && charCount > 0 && charCount < 20 ? (
              <span className="text-xs text-[var(--rh-teal)]">
                nice start! want to add more?
              </span>
            ) : (
              <span
                className={`text-xs ${meetsMinimum ? "text-green-600" : "text-[var(--rh-text-muted)]"}`}
              >
                {charCount}
                {effectiveMinLength ? ` / ${effectiveMinLength} min` : ""} characters
              </span>
            )}
            <button
              type="submit"
              disabled={!meetsMinimum || !text.trim()}
              className="px-5 py-2.5 rounded-xl bg-[var(--rh-cyan)] text-white text-sm font-semibold hover:bg-[var(--rh-teal)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {ageLevel === "kids" ? "share my thoughts" : "submit reflection"}
            </button>
          </div>
        </form>
      ) : role === "participant" && submitted ? (
        <div className="text-center py-6 text-[var(--rh-text-muted)]">
          <p className="text-2xl mb-2">🪞</p>
          <p className="text-sm">reflection submitted</p>
        </div>
      ) : (
        /* facilitator view */
        <div className="space-y-3 mt-4">
          {responses ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(responses).map(([pid, response]) => (
                <div
                  key={pid}
                  className="p-4 rounded-xl bg-white border border-black/5"
                >
                  <p className="text-xs font-medium text-[var(--rh-text-muted)] mb-1.5">
                    {participants?.[pid]?.displayName || `participant ${Object.keys(responses).indexOf(pid) + 1}`}
                  </p>
                  <p className="text-sm leading-relaxed">{String(response)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--rh-text-muted)]">
              reflections are private until revealed
            </p>
          )}
        </div>
      )}
    </div>
  );
}
