/**
 * pipeline-funnel.tsx — 5-stage funnel viz with per-stage progress bars.
 *
 * Each stage:
 *   - Trapezoidal bar with stage colour (the conceptual funnel shape)
 *   - Stage name + definition
 *   - Indicative target string from PIPELINE_FUNNEL
 *   - Progress bar showing current/target from PIPELINE_PROGRESS:
 *       green > 75 %, amber 50–75 %, red < 50 %, "awaiting input" if null
 *
 * Phase 1: PIPELINE_PROGRESS values are hardcoded (some null until garrett
 * or payton enters them). Phase 2 will pull from Supabase.
 */

import {
  PIPELINE_FUNNEL,
  PIPELINE_PROGRESS,
  WV_COLOURS,
} from "@/lib/strategy-data";

/** Per-stage live counts that override the hardcoded `current` values
    in PIPELINE_PROGRESS. Tier 1 of the operationalization plan supplies
    `proposal` and `contract`. The top three stays null until tier 2's
    admin form lands. */
export interface PipelineProgressOverrides {
  proposal?: number | null;
  contract?: number | null;
  awareness?: number | null;
  engagement?: number | null;
  conversation?: number | null;
}

function progressClass(pct: number): string {
  if (pct >= 75) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-400";
  return "bg-red-500";
}

function progressLabelClass(pct: number): string {
  if (pct >= 75) return "text-emerald-700 bg-emerald-50 border-emerald-200/50";
  if (pct >= 50) return "text-amber-700 bg-amber-50 border-amber-200/50";
  return "text-red-700 bg-red-50 border-red-200/50";
}

export function PipelineFunnel({
  overrides,
}: {
  overrides?: PipelineProgressOverrides;
} = {}) {
  return (
    <div className="space-y-2">
      {PIPELINE_FUNNEL.map((stage) => {
        const colour = WV_COLOURS[stage.colour];
        const baseProgress = PIPELINE_PROGRESS.find((p) => p.id === stage.id);
        // Apply override if the stage id matches a derived count (tier 1 wires
        // proposal + contract; tier 2 will wire the top three via the form).
        const overrideValue = overrides?.[stage.id as keyof PipelineProgressOverrides];
        const progress = baseProgress
          ? overrideValue !== undefined
            ? { ...baseProgress, current: overrideValue }
            : baseProgress
          : undefined;
        const lightStage =
          stage.colour === "champagne" || stage.colour === "lavender";
        const fgColour = lightStage ? "#273248" : "white";

        const hasCurrent = progress?.current != null;
        const pct = hasCurrent
          ? Math.min(100, Math.round((progress!.current! / progress!.target) * 100))
          : 0;

        return (
          <div
            key={stage.id}
            className="relative flex items-center justify-center"
          >
            <div
              className="rounded-md py-3 px-4 transition-all hover:brightness-105 space-y-2"
              style={{
                width: `${stage.widthPct}%`,
                backgroundColor: colour,
                color: fgColour,
              }}
            >
              {/* row 1: stage name + indicative target */}
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-sm font-semibold uppercase tracking-wider">
                    {stage.name}
                  </span>
                  <span className="text-[11px] opacity-80">
                    {stage.definition}
                  </span>
                </div>
                <span className="text-[11px] font-medium tabular-nums shrink-0 opacity-90">
                  {stage.target}
                </span>
              </div>

              {/* row 2: marketing role + duration */}
              <div className="text-[10px] opacity-75">
                {stage.marketingRole} · {stage.duration}
              </div>

              {/* row 3: progress bar (per Prompt 1) */}
              {progress && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="opacity-90">
                      {hasCurrent ? (
                        <>
                          <span className="font-semibold tabular-nums">
                            {progress.current} / {progress.target}
                          </span>{" "}
                          <span className="opacity-75">{progress.unitLabel}</span>
                        </>
                      ) : (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{
                            backgroundColor: lightStage
                              ? "rgba(39, 50, 72, 0.12)"
                              : "rgba(255, 255, 255, 0.18)",
                            color: fgColour,
                          }}
                        >
                          awaiting first input · target {progress.target} {progress.unitLabel}
                        </span>
                      )}
                    </span>
                    {hasCurrent && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border tabular-nums font-medium ${progressLabelClass(pct)}`}
                      >
                        {pct}%
                      </span>
                    )}
                  </div>
                  {hasCurrent && (
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{
                        backgroundColor: lightStage
                          ? "rgba(39, 50, 72, 0.15)"
                          : "rgba(255, 255, 255, 0.22)",
                      }}
                    >
                      <div
                        className={`h-full rounded-full transition-all ${progressClass(pct)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
