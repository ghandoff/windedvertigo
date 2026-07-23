"use client";

import { useState, useTransition } from "react";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addPollOptionsAction } from "./actions";

interface ManualSlot {
  key: number;
  startsAt: string;
  endsAt: string;
}

interface Props {
  pollId: string;
}

export function AddSlotsForm({ pollId }: Props) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<ManualSlot[]>([{ key: 0, startsAt: "", endsAt: "" }]);
  const [counter, setCounter] = useState(1);
  const [pending, startTransition] = useTransition();

  const boundAction = addPollOptionsAction.bind(null, pollId);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="h-3 w-3" />
        add time slots
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-md border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">add time slots</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        enter start and end times — these will be appended to the existing candidate slots.
        times are interpreted in pacific time.
      </p>

      <form
        action={boundAction}
        onSubmit={() => {
          // reset form after submission
          setSlots([{ key: 0, startsAt: "", endsAt: "" }]);
          setCounter(1);
          setOpen(false);
        }}
        className="space-y-2"
      >
        {slots.map((slot) => (
          <div key={slot.key} className="flex gap-2 items-center">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground block mb-1">start</label>
              <Input
                type="datetime-local"
                name="starts_at"
                required
                value={slot.startsAt}
                onChange={(e) =>
                  setSlots((p) =>
                    p.map((s) => (s.key === slot.key ? { ...s, startsAt: e.target.value } : s)),
                  )
                }
                className="text-sm h-8"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground block mb-1">end</label>
              <Input
                type="datetime-local"
                name="ends_at"
                required
                value={slot.endsAt}
                onChange={(e) =>
                  setSlots((p) =>
                    p.map((s) => (s.key === slot.key ? { ...s, endsAt: e.target.value } : s)),
                  )
                }
                className="text-sm h-8"
              />
            </div>
            {slots.length > 1 && (
              <button
                type="button"
                onClick={() => setSlots((p) => p.filter((s) => s.key !== slot.key))}
                className="mt-4 text-muted-foreground hover:text-destructive text-xs"
              >
                ✕
              </button>
            )}
          </div>
        ))}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              setSlots((p) => [...p, { key: counter, startsAt: "", endsAt: "" }]);
              setCounter((c) => c + 1);
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            + another slot
          </button>
          <Button type="submit" size="sm" className="h-7 text-xs ml-auto">
            add {slots.length} slot{slots.length !== 1 ? "s" : ""}
          </Button>
        </div>
      </form>
    </div>
  );
}
