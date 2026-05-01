"use client";

import { BloomsBadge } from "./blooms-badge";
import { AuthenticityRadar } from "./authenticity-radar";
import { BrandStrip } from "./brand-strip";
import { ExportMenu, type ExportOption } from "./export-menu";
import { TASK_FORMATS } from "@/lib/task-formats";
import type { GeneratedTask } from "@/lib/types";

interface TaskCardProps {
  task: GeneratedTask;
  on_view_rubric?: (task: GeneratedTask) => void;
  on_view_scaffold?: (task: GeneratedTask) => void;
  export_options?: ExportOption[];
}

export function TaskCard({ task, on_view_rubric, on_view_scaffold, export_options }: TaskCardProps) {
  const format_info = TASK_FORMATS[task.task_format];

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--color-text-on-dark-muted)] bg-white/5 px-2 py-0.5 rounded">
              {format_info.label}
            </span>
            <BloomsBadge level={task.blooms_level} />
          </div>
          <p className="text-xs text-[var(--color-text-on-dark-muted)]">
            ~{task.time_estimate_minutes} minutes
          </p>
        </div>
      </div>

      {/* task prompt */}
      <div className="bg-white/3 border border-white/5 rounded-lg p-4">
        <p className="text-sm text-[var(--color-text-on-dark)] leading-relaxed whitespace-pre-wrap">
          {task.prompt_text}
        </p>
      </div>

      {/* authenticity scores */}
      <AuthenticityRadar scores={task.authenticity_scores} />

      {/* reliability notes */}
      {task.reliability_notes.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-[var(--color-text-on-dark-muted)]">
            reliability notes
          </p>
          {task.reliability_notes.map((note, i) => (
            <div key={i} className="text-xs text-[var(--color-text-on-dark-muted)] bg-white/3 rounded px-3 py-2">
              <span className="text-[var(--dc-bloom-evaluate)]">{note.concern}</span>
              {" — "}
              {note.mitigation}
            </div>
          ))}
        </div>
      )}

      {/* actions */}
      <div className="flex items-center gap-3 pt-1">
        {on_view_rubric && (
          <button
            onClick={() => on_view_rubric(task)}
            className="text-xs font-medium text-[var(--wv-champagne)] hover:opacity-80 transition-opacity"
          >
            view rubric →
          </button>
        )}
        {on_view_scaffold && (
          <button
            onClick={() => on_view_scaffold(task)}
            className="text-xs font-medium text-[var(--wv-champagne)] hover:opacity-80 transition-opacity"
          >
            view ej scaffold →
          </button>
        )}
        {export_options && export_options.length > 0 && (
          <div className="ml-auto">
            <ExportMenu options={export_options} />
          </div>
        )}
      </div>

      {/* branding */}
      <BrandStrip />
    </div>
  );
}
