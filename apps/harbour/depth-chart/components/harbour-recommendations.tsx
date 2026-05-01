"use client";

import { BLOOMS_LEVELS } from "@/lib/blooms";
import type { HarbourRecommendation } from "@/lib/types";

interface HarbourRecommendationsProps {
  recommendations: HarbourRecommendation[];
}

const APP_META: Record<HarbourRecommendation["app"], { label: string; icon: string }> = {
  "raft-house": { label: "raft.house", icon: "🎮" },
  creaseworks: { label: "creaseworks", icon: "🎨" },
  "vertigo-vault": { label: "vertigo.vault", icon: "🃏" },
};

export function HarbourRecommendations({ recommendations }: HarbourRecommendationsProps) {
  const grouped = recommendations.reduce<Record<string, HarbourRecommendation[]>>((acc, rec) => {
    (acc[rec.app] ??= []).push(rec);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-[var(--color-text-on-dark)]">
          harbour recommendations
        </p>
        <p className="text-[10px] text-[var(--color-text-on-dark-muted)] mt-0.5">
          activities from the harbour ecosystem that address gaps in your curriculum
        </p>
      </div>

      {Object.entries(grouped).map(([app, recs]) => {
        const meta = APP_META[app as HarbourRecommendation["app"]];
        return (
          <div key={app} className="space-y-2">
            <p className="text-xs font-medium text-[var(--color-text-on-dark-muted)]">
              {meta.icon} {meta.label}
            </p>
            {recs.map((rec) => (
              <div
                key={rec.activity_slug}
                className="bg-white/3 border border-white/8 rounded-lg px-4 py-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-[var(--color-text-on-dark)]">
                      {rec.activity_name}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-on-dark-muted)] mt-0.5">
                      {rec.reason}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {rec.blooms_levels.map((level) => (
                      <span
                        key={level}
                        className="text-[9px] font-bold px-1 py-0.5 rounded"
                        style={{ backgroundColor: BLOOMS_LEVELS[level].color, color: "var(--wv-cadet)" }}
                      >
                        {BLOOMS_LEVELS[level].label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-on-dark-muted)]">
                  {rec.duration_minutes && <span>{rec.duration_minutes} min</span>}
                  {rec.group_size && (
                    <>
                      <span className="opacity-30">·</span>
                      <span>{rec.group_size}</span>
                    </>
                  )}
                  <span className="opacity-30">·</span>
                  <a
                    href={rec.url}
                    className="text-[var(--wv-champagne)] hover:opacity-80 transition-opacity"
                  >
                    preview →
                  </a>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
