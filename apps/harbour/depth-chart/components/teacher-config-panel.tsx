"use client";

import { useState, useCallback } from "react";
import { AUTHENTICITY_CRITERIA } from "@/lib/authenticity";
import { TASK_FORMATS } from "@/lib/task-formats";
import { get_valid_formats } from "@/lib/blooms";
import { FrameworkToggles } from "./framework-toggles";
import type { TeacherConfig, TaskFormat, BloomsLevel } from "@/lib/types";

interface TeacherConfigPanelProps {
  config: TeacherConfig;
  on_change: (config: TeacherConfig) => void;
  /** unique Bloom's levels present in the current plan — drives format options */
  active_levels: BloomsLevel[];
}

const COLLABORATION_OPTIONS: { value: TeacherConfig["collaboration_mode"]; label: string }[] = [
  { value: "individual", label: "individual" },
  { value: "pairs", label: "pairs" },
  { value: "small_group", label: "small group" },
  { value: "whole_class", label: "whole class" },
];

export function TeacherConfigPanel({ config, on_change, active_levels }: TeacherConfigPanelProps) {
  const [expanded, set_expanded] = useState(false);

  const update = useCallback(
    (patch: Partial<TeacherConfig>) => on_change({ ...config, ...patch }),
    [config, on_change]
  );

  // collect all valid formats across active levels
  const available_formats = Array.from(
    new Set(active_levels.flatMap((l) => get_valid_formats(l)))
  );

  const toggle_format = useCallback(
    (format: TaskFormat) => {
      const next = config.preferred_formats.includes(format)
        ? config.preferred_formats.filter((f) => f !== format)
        : [...config.preferred_formats, format];
      update({ preferred_formats: next });
    },
    [config.preferred_formats, update]
  );

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => set_expanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
      >
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-on-dark)]">
            task generation settings
          </h3>
          <p className="text-xs text-[var(--color-text-on-dark-muted)] mt-0.5">
            {config.max_minutes} min · {config.collaboration_mode} · {config.preferred_formats.length === 0 ? "all formats" : `${config.preferred_formats.length} format${config.preferred_formats.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <span className="text-[var(--color-text-on-dark-muted)] text-xs">
          {expanded ? "collapse" : "expand"}
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-6 border-t border-white/10 pt-5">
          {/* analytical frameworks */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-on-dark-muted)] mb-2">
              analytical frameworks
            </label>
            <FrameworkToggles
              frameworks={config.frameworks}
              on_change={(frameworks) => update({ frameworks })}
            />
          </div>

          {/* time limit */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-on-dark-muted)] mb-2">
              max task duration: {config.max_minutes} minutes
            </label>
            <input
              type="range"
              min={10}
              max={120}
              step={5}
              value={config.max_minutes}
              onChange={(e) => update({ max_minutes: Number(e.target.value) })}
              className="w-full accent-[var(--wv-champagne)]"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-on-dark-muted)] mt-1">
              <span>10 min</span>
              <span>120 min</span>
            </div>
          </div>

          {/* collaboration mode */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-on-dark-muted)] mb-2">
              collaboration mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              {COLLABORATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update({ collaboration_mode: opt.value })}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    config.collaboration_mode === opt.value
                      ? "bg-[var(--wv-champagne)] text-[var(--wv-cadet)]"
                      : "bg-white/5 text-[var(--color-text-on-dark-muted)] hover:bg-white/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* preferred formats */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-on-dark-muted)] mb-2">
              preferred task formats
              <span className="font-normal ml-1">(leave empty for auto-select)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {available_formats.map((format) => {
                const info = TASK_FORMATS[format];
                const selected = config.preferred_formats.includes(format);
                return (
                  <button
                    key={format}
                    onClick={() => toggle_format(format)}
                    title={info.description}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      selected
                        ? "bg-[var(--wv-champagne)] text-[var(--wv-cadet)] font-medium"
                        : "bg-white/5 text-[var(--color-text-on-dark-muted)] hover:bg-white/10"
                    }`}
                  >
                    {info.label}
                    <span className="ml-1 opacity-60">
                      {info.typical_minutes[0]}-{info.typical_minutes[1]}m
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* authenticity emphasis */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-on-dark-muted)] mb-2">
              authenticity emphasis
              <span className="font-normal ml-1">(higher = prioritize this dimension)</span>
            </label>
            <div className="space-y-3">
              {AUTHENTICITY_CRITERIA.map((criterion) => {
                const weight = config.authenticity_weights[criterion.key] ?? 3;
                return (
                  <div key={criterion.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[var(--color-text-on-dark)]">
                        {criterion.label}
                      </span>
                      <span className="text-xs text-[var(--color-text-on-dark-muted)] tabular-nums">
                        {weight}/5
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={weight}
                      onChange={(e) =>
                        update({
                          authenticity_weights: {
                            ...config.authenticity_weights,
                            [criterion.key]: Number(e.target.value),
                          },
                        })
                      }
                      title={criterion.description}
                      className="w-full accent-[var(--wv-champagne)]"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
