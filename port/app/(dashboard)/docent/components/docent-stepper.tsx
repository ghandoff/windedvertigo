"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEPS } from "../steps";
import { DOCENT_SECTIONS } from "../types";

// Grouped, clickable progress stepper. Sections (set up · connect · how we work)
// each hold their content steps as clickable segments. Free navigation — any step
// is reachable so members can skip to or revisit the part relevant to them.

const CONTENT_STEPS = STEPS.filter((s) => !s.meta);

export function DocentStepper({
  currentId,
  completedIds,
  onJump,
}: {
  currentId: string;
  completedIds: string[];
  onJump: (stepId: string) => void;
}) {
  return (
    <nav aria-label="docent progress" className="mb-6">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        {DOCENT_SECTIONS.map((section) => {
          const steps = CONTENT_STEPS.filter((s) => s.section === section.key);
          if (steps.length === 0) return null;
          const doneCount = steps.filter((s) => completedIds.includes(s.id)).length;
          const sectionActive = steps.some((s) => s.id === currentId);

          return (
            <div key={section.key} className="space-y-1.5">
              <button
                type="button"
                onClick={() => onJump(steps[0].id)}
                className={cn(
                  "flex items-center gap-1.5 text-[11px] uppercase tracking-wider transition-colors",
                  sectionActive ? "text-accent" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{section.label}</span>
                <span className="text-[10px] tabular-nums opacity-70">
                  {doneCount}/{steps.length}
                </span>
              </button>

              <div className="flex gap-1">
                {steps.map((s) => {
                  const isCurrent = s.id === currentId;
                  const isDone = completedIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onJump(s.id)}
                      aria-current={isCurrent ? "step" : undefined}
                      aria-label={`${section.label}: ${s.title}${
                        isDone ? " — done" : isCurrent ? " — current step" : ""
                      }`}
                      title={s.title}
                      className={cn(
                        "h-2 rounded-full transition-all hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
                        isCurrent ? "w-9 bg-accent" : "w-7",
                        !isCurrent && isDone && "bg-accent/60",
                        !isCurrent && !isDone && "bg-muted hover:bg-muted-foreground/30",
                      )}
                    >
                      {isDone && !isCurrent && (
                        <Check className="h-2 w-2 mx-auto text-white" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
