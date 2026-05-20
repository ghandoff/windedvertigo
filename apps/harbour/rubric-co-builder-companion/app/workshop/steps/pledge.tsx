"use client";

import { AI_USE_LEVELS } from "@/lib/types";
import type { AiUseLevel, Draft, Pledge } from "@/lib/types";

type Props = {
  draft: Draft;
  onPatch: (patch: Partial<Draft>) => void;
  onNext: () => void;
  onBack: () => void;
};

// The four pledge prompts. Order matters: agreement → constraint →
// transparency → recovery. Each field is independent — users can fill
// any combination, including just one. The "next" button doesn't gate
// on completeness because over-prescribing degrades the worksheet feel.
const PLEDGE_FIELDS: Array<{
  key: keyof Omit<Pledge, "ai_level">;
  label: string;
  hint: string;
}> = [
  {
    key: "will_use_for",
    label: "we will use AI for…",
    hint: "the specific tasks where AI is in-scope for this assessment.",
  },
  {
    key: "will_not_use_for",
    label: "we will NOT use AI for…",
    hint: "the boundaries — the parts that have to be human work.",
  },
  {
    key: "will_disclose",
    label: "we will disclose…",
    hint: "what students will say about their AI use, and where they'll say it.",
  },
  {
    key: "if_cross_line",
    label: "if we cross our own line, we will…",
    hint: "the recovery move — what happens when the pledge gets broken.",
  },
];

export function StepPledge({ draft, onPatch, onNext, onBack }: Props) {
  function setAiLevel(level: AiUseLevel) {
    onPatch({ pledge: { ...draft.pledge, ai_level: level } });
  }

  function setField(key: keyof Omit<Pledge, "ai_level">, value: string) {
    onPatch({ pledge: { ...draft.pledge, [key]: value } });
  }

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
          where AI fits in this assessment.
        </h1>
        <p style={{ color: "var(--color-cadet)" }}>
          pick a rung on the AI use ladder, then sketch the boundaries.
          this is the contract students sign with themselves — the bar they
          pledge to hold even when no one&apos;s watching.
        </p>
      </header>

      {/* AI ladder selector — five rungs from "no AI" to "AI is the subject" */}
      <section className="space-y-3">
        <p
          className="block text-sm font-medium"
          style={{ color: "var(--color-cadet)" }}
        >
          AI use ladder
        </p>
        <div
          role="radiogroup"
          aria-label="AI use ladder rung"
          className="space-y-2"
        >
          {[...AI_USE_LEVELS].reverse().map((rung) => {
            const picked = draft.pledge.ai_level === rung.level;
            return (
              <button
                key={rung.level}
                type="button"
                role="radio"
                aria-checked={picked}
                onClick={() => setAiLevel(rung.level)}
                className="w-full text-left rounded-lg p-4 border-l-4 transition-colors focus:outline-none"
                style={{
                  background: picked
                    ? "color-mix(in srgb, var(--color-champagne) 80%, white)"
                    : "white",
                  borderLeftColor: picked
                    ? "var(--color-sienna)"
                    : "color-mix(in srgb, var(--color-cadet) 15%, transparent)",
                  boxShadow: picked
                    ? "0 0 0 2px color-mix(in srgb, var(--color-cadet) 25%, transparent)"
                    : "none",
                }}
              >
                <div className="flex items-baseline gap-3">
                  <span
                    className="text-xs tracking-widest uppercase font-mono w-8 shrink-0"
                    style={{ color: "var(--color-redwood)" }}
                  >
                    {rung.level}
                  </span>
                  <div className="flex-1">
                    <p
                      className="text-sm font-bold"
                      style={{ color: "var(--color-cadet)" }}
                    >
                      {rung.name}
                    </p>
                    <p
                      className="text-xs mt-1 leading-relaxed"
                      style={{ color: "var(--color-cadet)", opacity: 0.75 }}
                    >
                      {rung.helper}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Four pledge-prompt fields */}
      <section className="space-y-4">
        <p
          className="block text-sm font-medium"
          style={{ color: "var(--color-cadet)" }}
        >
          the pledge, in your words
        </p>
        {PLEDGE_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1">
            <label
              htmlFor={`pledge-${field.key}`}
              className="block text-sm font-medium"
              style={{ color: "var(--color-cadet)" }}
            >
              {field.label}
            </label>
            <p
              className="text-xs"
              style={{ color: "var(--color-cadet)", opacity: 0.6 }}
            >
              {field.hint}
            </p>
            <textarea
              id={`pledge-${field.key}`}
              rows={2}
              maxLength={500}
              value={draft.pledge[field.key]}
              onChange={(e) => setField(field.key, e.target.value)}
              placeholder={`${field.label.replace(/…$/, "")} …`}
              className="w-full rounded-lg border bg-white px-4 py-3 text-sm leading-relaxed focus:outline-none"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--color-cadet) 20%, transparent)",
                color: "var(--color-cadet)",
              }}
            />
          </div>
        ))}
      </section>

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
