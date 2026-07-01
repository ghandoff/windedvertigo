"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createPollAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

interface Slot {
  key: number;
  startsAt: string;
  endsAt: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? "creating…" : "create poll"}
    </Button>
  );
}

export function CreatePollForm() {
  const [slots, setSlots] = useState<Slot[]>([{ key: 0, startsAt: "", endsAt: "" }]);
  const [counter, setCounter] = useState(1);

  function addSlot() {
    setSlots((prev) => [...prev, { key: counter, startsAt: "", endsAt: "" }]);
    setCounter((c) => c + 1);
  }

  function removeSlot(key: number) {
    setSlots((prev) => prev.filter((s) => s.key !== key));
  }

  function updateSlot(key: number, field: "startsAt" | "endsAt", value: string) {
    setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)));
  }

  return (
    <form action={createPollAction} className="space-y-6 max-w-lg">
      <div className="space-y-2">
        <Label htmlFor="title">title</Label>
        <Input
          id="title"
          name="title"
          required
          placeholder="e.g. q3 strategy session"
          className="lowercase"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">description <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Textarea
          id="description"
          name="description"
          placeholder="what's this meeting for? any context helps people decide."
          rows={3}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>candidate times</Label>
          <button
            type="button"
            onClick={addSlot}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            add slot
          </button>
        </div>

        {slots.map((slot, i) => (
          <div key={slot.key} className="flex gap-2 items-start">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground sr-only">slot {i + 1} start</Label>
              <Input
                type="datetime-local"
                name="starts_at"
                required
                value={slot.startsAt}
                onChange={(e) => updateSlot(slot.key, "startsAt", e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground sr-only">slot {i + 1} end</Label>
              <Input
                type="datetime-local"
                name="ends_at"
                required
                value={slot.endsAt}
                onChange={(e) => updateSlot(slot.key, "endsAt", e.target.value)}
                className="text-sm"
              />
            </div>
            {slots.length > 1 && (
              <button
                type="button"
                onClick={() => removeSlot(slot.key)}
                className="mt-2 text-muted-foreground hover:text-destructive"
                aria-label="remove slot"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}

        <p className="text-xs text-muted-foreground">
          times are in your local timezone and will be shown to respondents in theirs.
        </p>
      </div>

      <SubmitButton />
    </form>
  );
}
