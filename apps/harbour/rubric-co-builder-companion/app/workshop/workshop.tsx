"use client";

import { useEffect, useReducer } from "react";
import { Wordmark } from "../_components/wordmark";
import { StepFrame } from "./steps/frame";
import { StepSeed } from "./steps/seed";
import { StepScale } from "./steps/scale";
import { StepPledge } from "./steps/pledge";
import { StepCommit } from "./steps/commit";
import { loadDraft, saveDraft } from "@/lib/storage";
import { emptyDraft, STEP_ORDER } from "@/lib/types";
import type { Draft, DraftStep } from "@/lib/types";

type Action =
  | { type: "hydrate"; draft: Draft }
  | { type: "patch"; patch: Partial<Draft> }
  | { type: "goto"; step: DraftStep }
  | { type: "next" }
  | { type: "back" }
  | { type: "reset" };

function reducer(state: Draft, action: Action): Draft {
  switch (action.type) {
    case "hydrate":
      return action.draft;
    case "patch":
      return { ...state, ...action.patch };
    case "goto":
      return { ...state, step: action.step };
    case "next": {
      const i = STEP_ORDER.indexOf(state.step);
      const next = STEP_ORDER[Math.min(i + 1, STEP_ORDER.length - 1)];
      return { ...state, step: next };
    }
    case "back": {
      const i = STEP_ORDER.indexOf(state.step);
      const prev = STEP_ORDER[Math.max(i - 1, 0)];
      return { ...state, step: prev };
    }
    case "reset":
      return emptyDraft();
    default:
      return state;
  }
}

export function Workshop() {
  const [draft, dispatch] = useReducer(reducer, null, emptyDraft);

  // hydrate from sessionStorage on mount. avoids hydration mismatch by
  // starting with emptyDraft on both server and client, then replacing
  // state after mount.
  useEffect(() => {
    const stored = loadDraft();
    if (stored) dispatch({ type: "hydrate", draft: stored });
  }, []);

  // persist on every change after the initial mount.
  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  const surface =
    draft.step === "frame" || draft.step === "commit" ? "champagne" : "white";

  return (
    <main
      className="min-h-screen px-4 py-8 md:py-12"
      style={{
        background:
          surface === "champagne" ? "var(--color-champagne)" : "var(--color-wv-white)",
      }}
    >
      <Wordmark />
      <ProgressBar step={draft.step} />
      <div className="max-w-2xl mx-auto pt-8">
        {draft.step === "frame" && (
          <StepFrame
            draft={draft}
            onPatch={(patch) => dispatch({ type: "patch", patch })}
            onNext={() => dispatch({ type: "next" })}
          />
        )}
        {draft.step === "seed" && (
          <StepSeed
            draft={draft}
            onPatch={(patch) => dispatch({ type: "patch", patch })}
            onNext={() => dispatch({ type: "next" })}
            onBack={() => dispatch({ type: "back" })}
          />
        )}
        {draft.step === "scale" && (
          <StepScale
            draft={draft}
            onPatch={(patch) => dispatch({ type: "patch", patch })}
            onNext={() => dispatch({ type: "next" })}
            onBack={() => dispatch({ type: "back" })}
          />
        )}
        {draft.step === "pledge" && (
          <StepPledge
            draft={draft}
            onPatch={(patch) => dispatch({ type: "patch", patch })}
            onNext={() => dispatch({ type: "next" })}
            onBack={() => dispatch({ type: "back" })}
          />
        )}
        {draft.step === "commit" && (
          <StepCommit
            draft={draft}
            onBack={() => dispatch({ type: "back" })}
            onReset={() => dispatch({ type: "reset" })}
          />
        )}
      </div>
    </main>
  );
}

const STEP_LABELS: Record<DraftStep, string> = {
  frame: "frame",
  seed: "criteria",
  scale: "scale",
  pledge: "pledge",
  commit: "rubric",
};

function ProgressBar({ step }: { step: DraftStep }) {
  const i = STEP_ORDER.indexOf(step);
  return (
    <div
      className="max-w-2xl mx-auto flex items-center gap-2 no-print"
      style={{ color: "var(--color-cadet)" }}
    >
      {STEP_ORDER.map((s, idx) => (
        <div key={s} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="h-1 w-full rounded"
            style={{
              background:
                idx <= i
                  ? "var(--color-cadet)"
                  : "color-mix(in srgb, var(--color-cadet) 15%, transparent)",
            }}
          />
          <span
            className="text-[10px] uppercase tracking-widest"
            style={{ opacity: idx === i ? 1 : 0.5 }}
          >
            {STEP_LABELS[s]}
          </span>
        </div>
      ))}
    </div>
  );
}
