"use client";

import { BLOOMS_LEVELS, BLOOMS_ORDER } from "@/lib/blooms";
import { DOK_LEVELS, DOK_ORDER } from "@/lib/webb";
import { SOLO_LEVELS, SOLO_ORDER } from "@/lib/solo";
import { HarbourRecommendations } from "./harbour-recommendations";
import type { AlignmentReport as AlignmentReportType } from "@/lib/types";

interface AlignmentReportProps {
  report: AlignmentReportType;
}

export function AlignmentReport({ report }: AlignmentReportProps) {
  const max_count = Math.max(...Object.values(report.blooms_distribution), 1);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--color-text-on-dark)]">
          alignment report
        </p>
        <div className="flex gap-3 text-xs text-[var(--color-text-on-dark-muted)]">
          <span>{report.objectives_count} objectives</span>
          <span>{report.covered_count} covered</span>
          <span
            className={
              report.hocs_percentage >= 50
                ? "text-emerald-400"
                : "text-amber-400"
            }
          >
            {report.hocs_percentage.toFixed(0)}% HOCS
          </span>
        </div>
      </div>

      {/* Bloom's distribution bar chart */}
      <div className="space-y-1.5">
        {BLOOMS_ORDER.map((level) => {
          const count = report.blooms_distribution[level] || 0;
          const info = BLOOMS_LEVELS[level];
          return (
            <div key={level} className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-on-dark-muted)] w-20 shrink-0">
                {info.label}
              </span>
              <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all"
                  style={{
                    width: `${(count / max_count) * 100}%`,
                    backgroundColor: info.color,
                    minWidth: count > 0 ? "8px" : "0",
                  }}
                />
              </div>
              <span className="text-xs text-[var(--color-text-on-dark-muted)] w-4 text-right">
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Webb DOK distribution */}
      {report.webb_distribution && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[var(--color-text-on-dark-muted)]">
            webb's depth of knowledge
          </p>
          {DOK_ORDER.map((level) => {
            const count = report.webb_distribution![level] || 0;
            const info = DOK_LEVELS[level];
            const max_dok = Math.max(...Object.values(report.webb_distribution!), 1);
            return (
              <div key={level} className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-on-dark-muted)] w-20 shrink-0">
                  DOK {info.order}
                </span>
                <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all"
                    style={{
                      width: `${(count / max_dok) * 100}%`,
                      backgroundColor: info.color,
                      minWidth: count > 0 ? "8px" : "0",
                    }}
                  />
                </div>
                <span className="text-xs text-[var(--color-text-on-dark-muted)] w-4 text-right">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* SOLO distribution */}
      {report.solo_distribution && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[var(--color-text-on-dark-muted)]">
            SOLO taxonomy
          </p>
          {SOLO_ORDER.map((level) => {
            const count = report.solo_distribution![level] || 0;
            const info = SOLO_LEVELS[level];
            const max_solo = Math.max(...Object.values(report.solo_distribution!), 1);
            return (
              <div key={level} className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-on-dark-muted)] w-28 shrink-0 truncate" title={info.label}>
                  {info.label}
                </span>
                <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all"
                    style={{
                      width: `${(count / max_solo) * 100}%`,
                      backgroundColor: info.color,
                      minWidth: count > 0 ? "8px" : "0",
                    }}
                  />
                </div>
                <span className="text-xs text-[var(--color-text-on-dark-muted)] w-4 text-right">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* gaps */}
      {report.gaps.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[var(--dc-bloom-evaluate)]">
            alignment gaps
          </p>
          {report.gaps.map((gap, i) => (
            <div
              key={i}
              className="text-xs text-[var(--color-text-on-dark-muted)] bg-white/3 rounded px-3 py-2"
            >
              <span className="text-[var(--dc-bloom-evaluate)]">{gap.issue}</span>
              {" — "}
              {gap.suggestion}
            </div>
          ))}
        </div>
      )}

      {/* harbour recommendations */}
      {report.harbour_recommendations && report.harbour_recommendations.length > 0 && (
        <HarbourRecommendations recommendations={report.harbour_recommendations} />
      )}
    </div>
  );
}
