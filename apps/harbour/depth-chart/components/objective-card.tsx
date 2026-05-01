"use client";

import { BloomsBadge } from "./blooms-badge";
import type { LearningObjective } from "@/lib/types";

interface ObjectiveCardProps {
  objective: LearningObjective;
  on_generate?: (objective: LearningObjective) => void;
  is_generating?: boolean;
}

export function ObjectiveCard({ objective, on_generate, is_generating }: ObjectiveCardProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
        <p className="text-sm text-[var(--color-text-on-dark)] leading-relaxed flex-1">
          {objective.raw_text}
        </p>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <BloomsBadge level={objective.blooms_level} size="md" />
          {objective.webb_dok && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `var(--dc-dok-${objective.webb_dok})`, color: "var(--wv-cadet)" }}
            >
              DOK {objective.webb_dok}
            </span>
          )}
          {objective.solo_level && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `var(--dc-solo-${objective.solo_level.split("_")[0]})`, color: "var(--wv-cadet)" }}
            >
              {objective.solo_level.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-on-dark-muted)]">
        <span>
          verb: <strong className="text-[var(--color-text-on-dark)]">{objective.cognitive_verb}</strong>
        </span>
        <span className="opacity-30">|</span>
        <span>
          knowledge: <strong className="text-[var(--color-text-on-dark)]">{objective.knowledge_dimension}</strong>
        </span>
        <span className="opacity-30">|</span>
        <span>
          topic: <strong className="text-[var(--color-text-on-dark)]">{objective.content_topic}</strong>
        </span>
        {objective.confidence < 0.8 && (
          <>
            <span className="opacity-30">|</span>
            <span className="text-[var(--dc-bloom-evaluate)]">
              low confidence ({(objective.confidence * 100).toFixed(0)}%)
            </span>
          </>
        )}
      </div>

      {on_generate && (
        <button
          onClick={() => on_generate(objective)}
          disabled={is_generating}
          className="text-xs font-medium text-[var(--wv-champagne)] hover:opacity-80 transition-opacity disabled:opacity-40"
        >
          {is_generating ? "generating..." : "generate assessment task →"}
        </button>
      )}
    </div>
  );
}
