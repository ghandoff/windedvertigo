"use client";

import { useState, useTransition } from "react";
import { AddTaskForm } from "./add-task-form";
import { generateGapTasksAction } from "./actions";

type PersonOption = {
  id: string;
  display: string;
};

export function TasksHeader({
  persons,
  statusCounts,
}: {
  persons: PersonOption[];
  statusCounts: { todo: number; in_progress: number; done: number; dismissed: number };
}) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleGenerate() {
    setMessage(null);
    startTransition(async () => {
      const count = await generateGapTasksAction();
      setMessage(
        count > 0
          ? `created ${count} task${count === 1 ? "" : "s"} from data gaps`
          : "no new gaps found"
      );
      setTimeout(() => setMessage(null), 4000);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">research tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {statusCounts.todo} to do &middot; {statusCounts.in_progress} in progress &middot;{" "}
            {statusCounts.done} done
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="rounded-md bg-muted text-muted-foreground px-3 py-1.5 text-sm hover:text-foreground disabled:opacity-50 transition-colors"
          >
            {isPending ? "scanning..." : "generate from gaps"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {showForm ? "cancel" : "add task"}
          </button>
        </div>
      </div>

      {message && (
        <p className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">
          {message}
        </p>
      )}

      {showForm && (
        <AddTaskForm persons={persons} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}
