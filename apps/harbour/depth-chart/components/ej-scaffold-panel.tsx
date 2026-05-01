"use client";

import { BrandStrip } from "./brand-strip";
import type { EJScaffold } from "@/lib/types";

interface EJScaffoldPanelProps {
  scaffold: EJScaffold;
}

const SCAFFOLD_LABELS: Record<string, string> = {
  peer_review: "peer review protocol",
  self_assessment: "guided self-assessment",
  exemplar_comparison: "exemplar comparison",
  criteria_co_creation: "criteria co-creation",
};

export function EJScaffoldPanel({ scaffold }: EJScaffoldPanelProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--color-text-on-dark)]">
          evaluative judgment scaffold
        </p>
        <span className="text-xs bg-white/5 px-2 py-0.5 rounded text-[var(--color-text-on-dark-muted)]">
          {SCAFFOLD_LABELS[scaffold.type] || scaffold.type}
        </span>
      </div>

      <div className="bg-white/3 border border-white/5 rounded-lg p-4">
        <p className="text-sm text-[var(--color-text-on-dark)] leading-relaxed whitespace-pre-wrap">
          {scaffold.prompt_text}
        </p>
      </div>

      {scaffold.self_monitoring_prompt && (
        <div className="bg-[var(--dc-bloom-create)]/10 border border-[var(--dc-bloom-create)]/20 rounded-lg p-4">
          <p className="text-xs font-medium text-[var(--dc-bloom-create)] mb-1">
            self-monitoring check
          </p>
          <p className="text-sm text-[var(--color-text-on-dark)] leading-relaxed">
            {scaffold.self_monitoring_prompt}
          </p>
        </div>
      )}

      {scaffold.quality_criteria_visible && (
        <p className="text-xs text-emerald-400">
          quality criteria are made visible to students through this activity
        </p>
      )}

      <BrandStrip />
    </div>
  );
}
