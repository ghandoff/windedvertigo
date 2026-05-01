"use client";

import type { TeacherConfig } from "@/lib/types";

interface FrameworkTogglesProps {
  frameworks: TeacherConfig["frameworks"];
  on_change: (frameworks: TeacherConfig["frameworks"]) => void;
}

const FRAMEWORKS = [
  {
    key: "blooms" as const,
    label: "bloom's revised taxonomy",
    description: "cognitive operations: remember → create",
    always_on: true,
  },
  {
    key: "webb_dok" as const,
    label: "webb's depth of knowledge",
    description: "task complexity: recall → extended thinking",
    always_on: false,
  },
  {
    key: "solo" as const,
    label: "SOLO taxonomy",
    description: "learning depth: surface → deep understanding",
    always_on: false,
  },
] as const;

export function FrameworkToggles({ frameworks, on_change }: FrameworkTogglesProps) {
  return (
    <div className="space-y-2">
      {FRAMEWORKS.map((fw) => {
        const checked = fw.always_on || frameworks[fw.key as keyof typeof frameworks] === true;
        const disabled = fw.always_on;

        return (
          <label
            key={fw.key}
            className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
              disabled
                ? "bg-white/5 cursor-default"
                : checked
                  ? "bg-[var(--wv-champagne)]/5 cursor-pointer"
                  : "bg-white/5 hover:bg-white/8 cursor-pointer"
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => {
                if (fw.always_on) return;
                const key = fw.key as keyof typeof frameworks;
                on_change({ ...frameworks, [key]: !frameworks[key] });
              }}
              className="mt-0.5 accent-[var(--wv-champagne)]"
            />
            <div className="flex-1 min-w-0">
              <span className={`text-xs font-medium ${checked ? "text-[var(--color-text-on-dark)]" : "text-[var(--color-text-on-dark-muted)]"}`}>
                {fw.label}
                {fw.always_on && (
                  <span className="ml-1.5 text-[10px] text-[var(--color-text-on-dark-muted)] font-normal">(always on)</span>
                )}
              </span>
              <p className="text-[10px] text-[var(--color-text-on-dark-muted)] mt-0.5">
                {fw.description}
              </p>
            </div>
          </label>
        );
      })}
    </div>
  );
}
