"use client";

import { useRef, useState } from "react";
import { addPerson } from "../actions";

export function AddPersonForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [expanded, setExpanded] = useState(false);

  async function handleSubmit(formData: FormData) {
    await addPerson(formData);
    formRef.current?.reset();
    setExpanded(false);
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {expanded ? "cancel" : "+ add person"}
      </button>

      {expanded && (
        <form ref={formRef} action={handleSubmit} className="space-y-3 rounded-lg border border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">given names</span>
              <input
                name="givenNames"
                required
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                placeholder="e.g. garrett"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">surname</span>
              <input
                name="surname"
                required
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                placeholder="e.g. jaeger"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">sex</span>
              <select
                name="sex"
                defaultValue="U"
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
              >
                <option value="M">male</option>
                <option value="F">female</option>
                <option value="X">other</option>
                <option value="U">unknown</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">birth</span>
              <input
                name="birthDate"
                type="date"
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">death</span>
              <input
                name="deathDate"
                type="date"
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
              />
            </label>
          </div>

          <label className="flex items-center gap-2">
            <input name="isLiving" type="checkbox" defaultChecked value="true" className="rounded" />
            <span className="text-xs text-muted-foreground">living</span>
          </label>

          <button
            type="submit"
            className="w-full rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            save person
          </button>
        </form>
      )}
    </div>
  );
}
