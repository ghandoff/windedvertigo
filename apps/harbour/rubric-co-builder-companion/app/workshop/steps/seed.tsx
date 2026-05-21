"use client";

import { seedCriterion } from "@/lib/types";
import type { Criterion, Draft } from "@/lib/types";

type Props = {
  draft: Draft;
  onPatch: (patch: Partial<Draft>) => void;
  onNext: () => void;
  onBack: () => void;
};

export function StepSeed({ draft, onPatch, onNext, onBack }: Props) {
  function update(i: number, patch: Partial<Criterion>) {
    onPatch({
      criteria: draft.criteria.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    });
  }
  function remove(i: number) {
    onPatch({
      criteria: draft.criteria.filter((_, idx) => idx !== i),
    });
  }
  function add() {
    onPatch({
      criteria: [...draft.criteria, seedCriterion("", "")],
    });
  }

  const ready = draft.criteria.length >= 1 && draft.criteria.every((c) => c.name.trim());

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p
          className="text-xs tracking-widest uppercase"
          style={{ color: "var(--color-cadet)", opacity: 0.7 }}
        >
          step 2 of 5 · criteria
        </p>
        <h1 className="text-3xl font-bold" style={{ color: "var(--color-cadet)" }}>
          what counts as a good {draft.artefact || "artefact"}?
        </h1>
        <p style={{ color: "var(--color-cadet)" }}>
          rename, rewrite, or remove these. add more if your subject needs them.
          three to six criteria is a comfortable range.
        </p>
      </header>

      <div className="space-y-3">
        {draft.criteria.map((c, i) => (
          <div
            key={c.id}
            className="rounded-lg border bg-white p-4 space-y-3"
            style={{
              borderColor: "color-mix(in srgb, var(--color-cadet) 15%, transparent)",
            }}
          >
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={c.name}
                onChange={(e) => update(i, { name: e.target.value })}
                maxLength={120}
                placeholder="criterion name"
                className="flex-1 rounded border border-transparent px-3 py-2 font-medium focus:outline-none focus:bg-white"
                style={{
                  background: "color-mix(in srgb, var(--color-champagne) 40%, transparent)",
                }}
              />
              <label
                className="flex items-center gap-2 text-xs cursor-pointer"
                style={{ color: "var(--color-cadet)", opacity: 0.7 }}
                title="A non-negotiable bar — the work has to clear this to count."
              >
                <input
                  type="checkbox"
                  checked={c.required}
                  onChange={(e) => update(i, { required: e.target.checked })}
                  className="h-4 w-4"
                  style={{ accentColor: "var(--color-sienna)" }}
                />
                required
              </label>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`remove ${c.name || "criterion"}`}
                className="text-sm px-2"
                style={{ color: "var(--color-redwood)" }}
              >
                remove
              </button>
            </div>
            <textarea
              rows={2}
              value={c.good_description}
              onChange={(e) => update(i, { good_description: e.target.value })}
              maxLength={500}
              placeholder="what good looks like, in one line"
              className="w-full rounded border border-transparent px-3 py-2 text-sm leading-relaxed focus:outline-none focus:bg-white"
              style={{
                background: "color-mix(in srgb, var(--color-champagne) 40%, transparent)",
              }}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="text-sm underline underline-offset-4"
        style={{ color: "var(--color-cadet)" }}
      >
        add another criterion
      </button>

      <div className="flex items-center gap-4 pt-2">
        <button type="button" onClick={onBack} className="btn-secondary text-sm">
          back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!ready}
          className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          next: scale the criteria
        </button>
      </div>
    </div>
  );
}
