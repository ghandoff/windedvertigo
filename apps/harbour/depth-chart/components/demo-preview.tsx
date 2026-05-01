"use client";

import { useState } from "react";
import { BLOOMS_LEVELS } from "@/lib/blooms";

const sample_objective = {
  raw_text:
    "students will evaluate the ethical implications of using AI-generated content in academic research",
  blooms_level: "evaluate" as const,
  cognitive_verb: "evaluate",
  content_topic: "AI ethics in academia",
  confidence: 0.94,
};

const sample_task = {
  task_format: "scenario judgment",
  time_estimate: 45,
  prompt:
    "you are a journal editor who has received a submission where the methodology section appears to be AI-generated. using the ethical framework discussed in class, write a 500-word editorial decision that evaluates whether this constitutes academic misconduct, considering the spectrum between tool-assisted writing and fabrication.",
  rubric_preview: [
    { criterion: "ethical reasoning depth", weight: 30 },
    { criterion: "framework application", weight: 25 },
    { criterion: "nuance & counterarguments", weight: 25 },
    { criterion: "clarity of judgment", weight: 20 },
  ],
  authenticity: { realism: 4.2, complexity: 3.8, challenge: 4.0, reflection: 4.5 },
};

export default function DemoPreview() {
  const [revealed, set_revealed] = useState(false);
  const bloom = BLOOMS_LEVELS[sample_objective.blooms_level];

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* input side */}
        <div className="space-y-3">
          <span className="text-[10px] font-semibold tracking-widest text-[var(--color-text-on-dark-muted)]">
            input — learning objective
          </span>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
            <p className="text-sm text-[var(--color-text-on-dark)] leading-relaxed italic">
              &ldquo;{sample_objective.raw_text}&rdquo;
            </p>
            <div className="flex flex-wrap gap-2 text-[10px]">
              <span
                className="px-2 py-0.5 rounded-full font-semibold"
                style={{
                  backgroundColor: `color-mix(in srgb, ${bloom.color} 20%, transparent)`,
                  color: bloom.color,
                }}
              >
                {bloom.label}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-[var(--color-text-on-dark-muted)]">
                verb: {sample_objective.cognitive_verb}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-[var(--color-text-on-dark-muted)]">
                {(sample_objective.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
          </div>

          {!revealed && (
            <button
              onClick={() => set_revealed(true)}
              className="w-full py-3 rounded-lg bg-[var(--wv-champagne)] text-[var(--wv-cadet)] font-semibold text-sm hover:opacity-90 transition-opacity cursor-pointer"
            >
              see what depth.chart generates →
            </button>
          )}
        </div>

        {/* output side */}
        <div
          className="space-y-3 transition-all duration-700 ease-out"
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateX(0)" : "translateX(20px)",
          }}
        >
          {revealed && (
            <>
              <span className="text-[10px] font-semibold tracking-widest text-[var(--color-text-on-dark-muted)]">
                output — assessment task
              </span>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
                {/* task header */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${bloom.color} 20%, transparent)`,
                      color: bloom.color,
                    }}
                  >
                    {bloom.label}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[var(--color-text-on-dark-muted)]">
                    {sample_task.task_format}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-on-dark-muted)] ml-auto">
                    ~{sample_task.time_estimate} min
                  </span>
                </div>

                {/* task prompt */}
                <div className="bg-white/3 border border-white/5 rounded-lg p-3">
                  <p className="text-xs text-[var(--color-text-on-dark)] leading-relaxed">
                    {sample_task.prompt}
                  </p>
                </div>

                {/* rubric preview */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold text-[var(--color-text-on-dark-muted)]">
                    rubric criteria
                  </span>
                  {sample_task.rubric_preview.map((c) => (
                    <div key={c.criterion} className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{
                            width: `${c.weight}%`,
                            backgroundColor: bloom.color,
                            transitionDelay: "400ms",
                          }}
                        />
                      </div>
                      <span className="text-[9px] text-[var(--color-text-on-dark-muted)] w-32 truncate">
                        {c.criterion}
                      </span>
                      <span className="text-[9px] text-[var(--color-text-on-dark-muted)] w-6 text-right">
                        {c.weight}%
                      </span>
                    </div>
                  ))}
                </div>

                {/* authenticity scores */}
                <div className="flex gap-3 pt-1">
                  {Object.entries(sample_task.authenticity).map(([key, val]) => (
                    <div key={key} className="text-center">
                      <span className="text-sm font-bold text-emerald-400">{val}</span>
                      <p className="text-[8px] text-[var(--color-text-on-dark-muted)]">{key}</p>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-[var(--color-text-on-dark-muted)] text-center">
                ↑ includes analytic rubric, EJ scaffold, and QTI/PDF/CSV exports
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
