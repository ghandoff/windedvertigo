"use client";

import { AUTHENTICITY_CRITERIA, authenticity_score, passes_authenticity_gate } from "@/lib/authenticity";
import type { AuthenticityProfile } from "@/lib/types";

interface AuthenticityRadarProps {
  scores: AuthenticityProfile;
}

export function AuthenticityRadar({ scores }: AuthenticityRadarProps) {
  const avg = authenticity_score(scores);
  const passes = passes_authenticity_gate(scores);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--color-text-on-dark-muted)]">
          authenticity profile
        </p>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            passes
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-red-500/15 text-red-400"
          }`}
        >
          {avg.toFixed(1)} avg {passes ? "— pass" : "— below threshold"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {AUTHENTICITY_CRITERIA.map((criterion) => {
          const value = scores[criterion.key];
          return (
            <div key={criterion.key} className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-on-dark-muted)] w-24 shrink-0">
                {criterion.label}
              </span>
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    value >= 3 ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                  style={{ width: `${(value / 5) * 100}%` }}
                />
              </div>
              <span className="text-xs text-[var(--color-text-on-dark-muted)] w-4 text-right">
                {value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
