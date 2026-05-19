"use client";

import { ARTIFACT_EXAMPLES, seedCriterion, SEED_CRITERIA } from "@/lib/types";
import type { Draft } from "@/lib/types";

type Props = {
  draft: Draft;
  onPatch: (patch: Partial<Draft>) => void;
  onNext: () => void;
};

export function StepFrame({ draft, onPatch, onNext }: Props) {
  const ready = draft.learning_outcome.trim() && draft.artefact.trim();

  function handleNext() {
    // seed the criteria list with defaults if the user has none yet —
    // they'll edit / add / remove on the next step.
    if (draft.criteria.length === 0) {
      onPatch({
        criteria: SEED_CRITERIA.map((s) =>
          seedCriterion(s.name, s.good_description ?? "", false),
        ),
      });
    }
    onNext();
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p
          className="text-xs tracking-widest uppercase"
          style={{ color: "var(--color-cadet)", opacity: 0.7 }}
        >
          step 1 of 5 · frame
        </p>
        <h1
          className="text-3xl font-bold"
          style={{ color: "var(--color-cadet)" }}
        >
          what are you assessing?
        </h1>
      </header>

      <div className="space-y-2">
        <label
          htmlFor="outcome"
          className="block text-sm font-medium"
          style={{ color: "var(--color-cadet)" }}
        >
          learning outcome
        </label>
        <textarea
          id="outcome"
          rows={3}
          maxLength={1000}
          value={draft.learning_outcome}
          onChange={(e) => onPatch({ learning_outcome: e.target.value })}
          placeholder="by the end of this assessment, students should be able to…"
          className="w-full rounded-lg border bg-white px-4 py-3 text-base leading-relaxed focus:outline-none"
          style={{
            borderColor: "color-mix(in srgb, var(--color-cadet) 20%, transparent)",
          }}
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="artefact"
          className="block text-sm font-medium"
          style={{ color: "var(--color-cadet)" }}
        >
          artefact
        </label>
        <p
          className="text-xs"
          style={{ color: "var(--color-cadet)", opacity: 0.6 }}
        >
          the deliverable students create to demonstrate learning.
        </p>
        <input
          id="artefact"
          type="text"
          list="artefact-examples"
          maxLength={1000}
          value={draft.artefact}
          onChange={(e) => onPatch({ artefact: e.target.value })}
          placeholder="e.g. presentation, essay, prototype…"
          className="w-full rounded-lg border bg-white px-4 py-3 text-base focus:outline-none"
          style={{
            borderColor: "color-mix(in srgb, var(--color-cadet) 20%, transparent)",
          }}
        />
        <datalist id="artefact-examples">
          {ARTIFACT_EXAMPLES.map((ex) => (
            <option key={ex} value={ex} />
          ))}
        </datalist>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleNext}
          disabled={!ready}
          className="btn-primary text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          next: pick criteria
        </button>
        <p
          className="text-xs"
          style={{ color: "var(--color-cadet)", opacity: 0.6 }}
        >
          we&apos;ll seed four common ones for you to edit.
        </p>
      </div>
    </div>
  );
}
