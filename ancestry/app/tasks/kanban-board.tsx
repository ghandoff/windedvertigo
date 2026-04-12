"use client";

import { useTransition, useState } from "react";
import { updateTaskStatusAction, deleteTaskAction } from "./actions";
import type { ResearchTask, TaskStatus } from "@/lib/types";

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-500/10 text-red-600",
  medium: "bg-yellow-500/10 text-yellow-600",
  low: "bg-blue-500/10 text-blue-600",
};

const SOURCE_STYLES: Record<string, string> = {
  auto_gap: "bg-purple-500/10 text-purple-600",
  auto_hint: "bg-green-500/10 text-green-600",
  manual: "bg-muted text-muted-foreground",
};

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "to do" },
  { key: "in_progress", label: "in progress" },
  { key: "done", label: "done" },
];

function TaskCard({ task }: { task: ResearchTask }) {
  const [isPending, startTransition] = useTransition();

  const status = task.status as TaskStatus;
  const canMoveLeft = status === "in_progress" || status === "done";
  const canMoveRight = status === "todo" || status === "in_progress";

  const prevStatus: TaskStatus | null =
    status === "in_progress" ? "todo" : status === "done" ? "in_progress" : null;
  const nextStatus: TaskStatus | null =
    status === "todo" ? "in_progress" : status === "in_progress" ? "done" : null;

  function moveTo(newStatus: TaskStatus) {
    startTransition(() => updateTaskStatusAction(task.id, newStatus));
  }

  function dismiss() {
    startTransition(() => updateTaskStatusAction(task.id, "dismissed"));
  }

  function remove() {
    startTransition(() => deleteTaskAction(task.id));
  }

  return (
    <div
      className={`rounded-md border border-border bg-card p-3 space-y-2 transition-opacity ${
        isPending ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground leading-snug">{task.title}</p>
        <button
          onClick={remove}
          disabled={isPending}
          className="text-muted-foreground hover:text-red-500 text-xs shrink-0 transition-colors"
          title="delete task"
        >
          &times;
        </button>
      </div>

      {task.person_name && (
        <p className="text-xs text-muted-foreground">{task.person_name}</p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
            PRIORITY_STYLES[task.priority] ?? ""
          }`}
        >
          {task.priority}
        </span>
        {task.source && (
          <span
            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
              SOURCE_STYLES[task.source] ?? "bg-muted text-muted-foreground"
            }`}
          >
            {task.source.replace("_", " ")}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 pt-1">
        {canMoveLeft && prevStatus && (
          <button
            onClick={() => moveTo(prevStatus)}
            disabled={isPending}
            className="rounded bg-muted text-muted-foreground px-2 py-0.5 text-[10px] hover:text-foreground disabled:opacity-50 transition-colors"
          >
            &larr; {prevStatus === "todo" ? "to do" : prevStatus.replace("_", " ")}
          </button>
        )}
        {canMoveRight && nextStatus && (
          <button
            onClick={() => moveTo(nextStatus)}
            disabled={isPending}
            className="rounded bg-muted text-muted-foreground px-2 py-0.5 text-[10px] hover:text-foreground disabled:opacity-50 transition-colors"
          >
            {nextStatus === "in_progress" ? "in progress" : nextStatus} &rarr;
          </button>
        )}
        {status !== "dismissed" && (
          <button
            onClick={dismiss}
            disabled={isPending}
            className="rounded bg-muted text-muted-foreground px-2 py-0.5 text-[10px] hover:text-foreground disabled:opacity-50 transition-colors ml-auto"
          >
            dismiss
          </button>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({ tasks }: { tasks: ResearchTask[] }) {
  const [showDismissed, setShowDismissed] = useState(false);
  const dismissed = tasks.filter((t) => t.status === "dismissed");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const columnTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {col.label}
                </h2>
                <span className="text-xs text-muted-foreground">
                  ({columnTasks.length})
                </span>
              </div>
              <div className="space-y-2 min-h-[4rem]">
                {columnTasks.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-4 text-center">
                    <p className="text-xs text-muted-foreground">no tasks</p>
                  </div>
                ) : (
                  columnTasks.map((task) => <TaskCard key={task.id} task={task} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* dismissed tasks toggle */}
      {dismissed.length > 0 && (
        <div className="border-t border-border pt-3">
          <button
            onClick={() => setShowDismissed(!showDismissed)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDismissed ? "hide" : "show"} dismissed ({dismissed.length})
          </button>
          {showDismissed && (
            <div className="mt-2 space-y-2 max-w-md">
              {dismissed.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
