"use client";

import { useMemo } from "react";
import { DEFAULT_DESCRIPTORS, SCALE_LEVELS } from "@/lib/types";
import type { Descriptor, Draft, ScaleLevel } from "@/lib/types";

type Props = {
  draft: Draft;
  onPatch: (patch: Partial<Draft>) => void;
  onNext: () => void;
  onBack: () => void;
};

export function StepScale({ draft, onPatch, onNext, onBack }: Props) {
  // ensure a descriptor row exists for every criterion × level combo
  const descriptors = useMemo<Descriptor[]>(() => {
    const map = new Map<string, Descriptor>();
    for (const d of draft.descriptors) {
      map.set(`${d.criterion_id}:${d.level}`, d);
    }
    const out: Descriptor[] = [];
    for (const c of draft.criteria) {
      for (const lvl of SCALE_LEVELS) {
        const key = `${c.id}:${lvl.level}`;
        out.push(
          map.get(key) ?? {
            criterion_id: c.id,
            level: lvl.level,
            text: lvl.level === 3 ? c.good_description : DEFAULT_DESCRIPTORS[lvl.level],
          },
        );
      }
    }
    return out;
  }, [draft.criteria, draft.descriptors]);

  function updateDescriptor(criterionId: string, level: ScaleLevel, text: string) {
    const next = descriptors.map((d) =>
      d.criterion_id === criterionId && d.level === level ? { ...d, text } : d,
    );
    onPatch({ descriptors: next });
  }

  function persistAndNext() {
    onPatch({ descriptors });
    onNext();
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p
          className="text-xs tracking-widest"
          style={{ color: "var(--color-cadet)", opacity: 0.7 }}
        >
          step 3 of 5 · scale
        </p>
        <h1 className="text-3xl font-bold" style={{ color: "var(--color-cadet)" }}>
          what does each level look like?
        </h1>
        <p style={{ color: "var(--color-cadet)" }}>
          for each criterion, sketch what exploring, emerging, proficient, and
          advanced work look like. we&apos;ve filled in defaults. edit anything
          that doesn&apos;t fit your subject.
        </p>
      </header>

      {draft.criteria.map((c) => (
        <section
          key={c.id}
          className="rounded-lg border bg-white p-5 space-y-4"
          style={{
            borderColor: "color-mix(in srgb, var(--color-cadet) 15%, transparent)",
          }}
        >
          <h2 className="text-xl font-bold" style={{ color: "var(--color-cadet)" }}>
            {c.name || "(unnamed criterion)"}
          </h2>
          <p
            className="text-xs italic"
            style={{ color: "var(--color-cadet)", opacity: 0.7 }}
          >
            good looks like: {c.good_description || "…"}
          </p>
          <div className="space-y-3">
            {SCALE_LEVELS.map((lvl) => {
              const d =
                descriptors.find(
                  (x) => x.criterion_id === c.id && x.level === lvl.level,
                ) ?? { criterion_id: c.id, level: lvl.level, text: "" };
              return (
                <div key={lvl.level} className="flex gap-3 items-start">
                  <div
                    className="w-24 shrink-0 text-xs tracking-widest pt-2"
                    style={{ color: "var(--color-cadet)", opacity: 0.7 }}
                  >
                    {lvl.level} · {lvl.label}
                  </div>
                  <textarea
                    rows={2}
                    value={d.text}
                    onChange={(e) =>
                      updateDescriptor(c.id, lvl.level, e.target.value)
                    }
                    className="flex-1 rounded border px-3 py-2 text-sm leading-relaxed focus:outline-none"
                    style={{
                      background:
                        "color-mix(in srgb, var(--color-champagne) 30%, transparent)",
                      borderColor:
                        "color-mix(in srgb, var(--color-cadet) 15%, transparent)",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex items-center gap-4 pt-2">
        <button type="button" onClick={onBack} className="btn-secondary text-sm">
          back
        </button>
        <button
          type="button"
          onClick={persistAndNext}
          className="btn-primary text-sm"
        >
          next: add a pledge
        </button>
      </div>
    </div>
  );
}
