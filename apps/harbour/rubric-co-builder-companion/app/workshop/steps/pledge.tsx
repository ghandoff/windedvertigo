"use client";

import type { Draft } from "@/lib/types";

type Props = {
  draft: Draft;
  onPatch: (patch: Partial<Draft>) => void;
  onNext: () => void;
  onBack: () => void;
};

const PROMPTS = [
  "the one thing we won't compromise on is…",
  "if we run out of time, we still need…",
  "we'll know we did this with integrity if…",
  "we'd rather miss a deadline than miss…",
];

export function StepPledge({ draft, onPatch, onNext, onBack }: Props) {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p
          className="text-xs tracking-widest uppercase"
          style={{ color: "var(--color-cadet)", opacity: 0.7 }}
        >
          step 4 of 5 · pledge
        </p>
        <h1 className="text-3xl font-bold" style={{ color: "var(--color-cadet)" }}>
          one quality bar you won&apos;t compromise on.
        </h1>
        <p style={{ color: "var(--color-cadet)" }}>
          a pledge is a single sentence that sits above the rubric — the
          non-negotiable promise to the reader, the team, or yourself. pick a
          prompt below, or write your own.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-2">
        {PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPatch({ pledge: { text: p + " " } })}
            className="text-left rounded-lg border bg-white p-3 text-sm leading-relaxed hover:bg-[color:var(--color-champagne)]"
            style={{
              color: "var(--color-cadet)",
              borderColor: "color-mix(in srgb, var(--color-cadet) 15%, transparent)",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <textarea
        rows={5}
        value={draft.pledge.text}
        onChange={(e) => onPatch({ pledge: { text: e.target.value } })}
        maxLength={500}
        placeholder="write your pledge here…"
        className="w-full rounded-lg border bg-white px-4 py-3 text-base leading-relaxed focus:outline-none"
        style={{
          borderColor: "color-mix(in srgb, var(--color-cadet) 20%, transparent)",
          color: "var(--color-cadet)",
        }}
      />

      <div className="flex items-center gap-4 pt-2">
        <button type="button" onClick={onBack} className="btn-secondary text-sm">
          back
        </button>
        <button type="button" onClick={onNext} className="btn-primary text-base">
          next: see the rubric
        </button>
      </div>
    </div>
  );
}
