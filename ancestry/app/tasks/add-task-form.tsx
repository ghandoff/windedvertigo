"use client";

import { useTransition, useRef } from "react";
import { createTaskAction } from "./actions";

type PersonOption = {
  id: string;
  display: string;
};

export function AddTaskForm({
  persons,
  onClose,
}: {
  persons: PersonOption[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await createTaskAction(formData);
      formRef.current?.reset();
      onClose();
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-medium text-foreground">add task</h3>
      <form ref={formRef} action={handleSubmit} className="space-y-3" data-1p-ignore autoComplete="off">
        <div>
          <label htmlFor="title" className="block text-xs text-muted-foreground mb-1">
            title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            placeholder="e.g. find birth certificate for..."
            className="w-full rounded-md border border-border bg-background text-foreground text-sm px-3 py-1.5 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-xs text-muted-foreground mb-1">
            description
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            placeholder="optional notes..."
            className="w-full rounded-md border border-border bg-background text-foreground text-sm px-3 py-1.5 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="person_id" className="block text-xs text-muted-foreground mb-1">
              person
            </label>
            <select
              id="person_id"
              name="person_id"
              className="w-full rounded-md border border-border bg-background text-foreground text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">none</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display}
                </option>
              ))}
            </select>
          </div>

          <div className="w-28">
            <label htmlFor="priority" className="block text-xs text-muted-foreground mb-1">
              priority
            </label>
            <select
              id="priority"
              name="priority"
              defaultValue="medium"
              className="w-full rounded-md border border-border bg-background text-foreground text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isPending ? "adding..." : "add task"}
          </button>
        </div>
      </form>
    </div>
  );
}
