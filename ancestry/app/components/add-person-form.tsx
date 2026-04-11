"use client";

import { useRef, useState } from "react";
import { addPerson } from "../actions";

export function AddPersonForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [sex, setSex] = useState("U");

  async function handleSubmit(formData: FormData) {
    await addPerson(formData);
    formRef.current?.reset();
    setExpanded(false);
    setSex("U");
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
          {/* name row: first, middle, surname */}
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">first name</span>
              <input
                name="givenNames"
                required
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                placeholder="e.g. garrett"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">middle name</span>
              <input
                name="middleName"
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                placeholder="e.g. james"
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

          {/* maiden name — shown when sex is F */}
          {sex === "F" && (
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">maiden name <span className="text-muted-foreground/60">(birth surname, if different)</span></span>
              <input
                name="maidenName"
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                placeholder="e.g. smith"
              />
            </label>
          )}

          {/* sex, birth date, death date */}
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">sex</span>
              <select
                name="sex"
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
              >
                <option value="M">male</option>
                <option value="F">female</option>
                <option value="X">other</option>
                <option value="U">unknown</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">date of birth</span>
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

          {/* birth place */}
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">place of birth</span>
            <input
              name="birthPlace"
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
              placeholder="e.g. san francisco, ca, usa"
            />
          </label>

          {/* current residence */}
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">current residence <span className="text-muted-foreground/60">(city, state, country)</span></span>
            <input
              name="currentResidence"
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
              placeholder="e.g. san francisco, ca 94110, usa"
            />
          </label>

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
