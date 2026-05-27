"use client";

import { COURSE_CONTEXTS, seedCriterion, SEED_CRITERIA } from "@/lib/types";
import type { CourseContext, Draft } from "@/lib/types";

type Props = {
  draft: Draft;
  onPatch: (patch: Partial<Draft>) => void;
  onNext: () => void;
};

export function StepFrame({ draft, onPatch, onNext }: Props) {
  const ready = draft.learning_outcome.trim() && draft.artefact.trim();

  // The artefact field stores free text. To know if a card is "selected"
  // we compare against the canonical artefact sentence for each context.
  // This lets users tap a card, then tweak the wording, and still see
  // the card highlighted until the text diverges materially.
  function isPicked(ctx: CourseContext): boolean {
    return draft.artefact.trim() === ctx.artefact.trim();
  }

  function pickContext(ctx: CourseContext) {
    onPatch({ artefact: ctx.artefact });
  }

  function handleNext() {
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
          className="text-xs tracking-widest"
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

      {/*
        Course-context picker (replaces the old free-text + datalist artefact
        field). Six PRME-anchored teaching scenarios, two-column grid on md+
        viewports, single column on mobile. Tapping a card pre-fills the
        artefact field below with the canonical artefact sentence; the
        picker is *optional* — users can also skip it and type their own
        artefact directly in the textarea below.

        Hint placement: the "pick or skip" framing lives *above* the
        grid, so users who don't pick anything aren't reading a
        confusing "edit if your card doesn't fit" message that presumes
        they picked one. (PR #114 polish #1.)
      */}
      <div className="space-y-3">
        <div className="space-y-1">
          <p
            className="block text-sm font-medium"
            style={{ color: "var(--color-cadet)" }}
          >
            course context · optional starting point
          </p>
          <p
            className="text-xs"
            style={{ color: "var(--color-cadet)", opacity: 0.6 }}
          >
            tap the closest PRME scenario to pre-fill the artefact field
            below, or skip the cards and write your own artefact.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="course context"
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          {COURSE_CONTEXTS.map((ctx) => {
            const picked = isPicked(ctx);
            return (
              <button
                key={ctx.id}
                type="button"
                role="radio"
                aria-checked={picked}
                onClick={() => pickContext(ctx)}
                className="text-left rounded-lg p-4 border-l-4 transition-colors focus:outline-none"
                style={{
                  background: picked
                    ? "color-mix(in srgb, var(--color-champagne) 80%, white)"
                    : "color-mix(in srgb, var(--color-champagne) 50%, white)",
                  borderLeftColor: picked
                    ? "var(--color-redwood)"
                    : "color-mix(in srgb, var(--color-redwood) 50%, transparent)",
                  boxShadow: picked
                    ? "0 0 0 2px color-mix(in srgb, var(--color-cadet) 25%, transparent)"
                    : "none",
                }}
              >
                <p
                  className="text-[10px] tracking-widest mb-1"
                  style={{ color: "var(--color-redwood)" }}
                >
                  context {ctx.number}
                </p>
                <p
                  className="text-sm font-bold"
                  style={{ color: "var(--color-cadet)" }}
                >
                  {ctx.title} · {ctx.level}
                </p>
                <p
                  className="text-xs italic mt-1"
                  style={{ color: "var(--color-cadet)", opacity: 0.75 }}
                >
                  &ldquo;{ctx.theme}&rdquo;
                </p>
                <p
                  className="text-xs mt-2 leading-relaxed"
                  style={{ color: "var(--color-cadet)" }}
                >
                  artefact: {ctx.artefact}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Editable artefact field — pre-filled when a card is picked,
          but the user can override for courses that don't match any
          of the six contexts. The "pick or write your own" guidance
          lives above the cards so it applies whether the user used
          the picker or skipped it (PR #114 polish #1). */}
      <div className="space-y-2">
        <label
          htmlFor="artefact"
          className="block text-sm font-medium"
          style={{ color: "var(--color-cadet)" }}
        >
          artefact
        </label>
        <textarea
          id="artefact"
          rows={3}
          maxLength={1000}
          value={draft.artefact}
          onChange={(e) => onPatch({ artefact: e.target.value })}
          placeholder="pick a course context above, or describe your own artefact here…"
          className="w-full rounded-lg border bg-white px-4 py-3 text-base leading-relaxed focus:outline-none"
          style={{
            borderColor: "color-mix(in srgb, var(--color-cadet) 20%, transparent)",
          }}
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleNext}
          disabled={!ready}
          className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
