"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addOverrideAction,
  deleteOverrideAction,
  updateWorkingHoursAction,
} from "../actions";
import { parseTstzrange, type AvailabilityOverride, type Host, type WorkingHours } from "@/lib/booking/types";

const DAYS: Array<{ key: string; label: string }> = [
  { key: "mon", label: "monday" },
  { key: "tue", label: "tuesday" },
  { key: "wed", label: "wednesday" },
  { key: "thu", label: "thursday" },
  { key: "fri", label: "friday" },
  { key: "sat", label: "saturday" },
  { key: "sun", label: "sunday" },
];

interface Props {
  host: Host;
  overrides: AvailabilityOverride[];
}

export function HostAvailabilityCard({ host, overrides }: Props) {
  const router = useRouter();
  const [hours, setHours] = useState<WorkingHours>(host.working_hours ?? {});
  const [bufferBefore, setBufferBefore] = useState(host.buffer_before_min);
  const [bufferAfter, setBufferAfter] = useState(host.buffer_after_min);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateDay(dayKey: string, idx: number, which: 0 | 1, value: string) {
    setHours((prev) => {
      const next = { ...prev };
      const ranges = (next[dayKey] ?? []).map((r) => [...r] as [string, string]);
      if (!ranges[idx]) return prev;
      ranges[idx][which] = value;
      next[dayKey] = ranges;
      return next;
    });
  }

  function addRange(dayKey: string) {
    setHours((prev) => {
      const next = { ...prev };
      const ranges = next[dayKey] ?? [];
      next[dayKey] = [...ranges, ["09:00", "17:00"]];
      return next;
    });
  }

  function removeRange(dayKey: string, idx: number) {
    setHours((prev) => {
      const next = { ...prev };
      const ranges = (next[dayKey] ?? []).filter((_, i) => i !== idx);
      next[dayKey] = ranges;
      return next;
    });
  }

  function save() {
    setSavedMsg(null);
    setError(null);
    startTransition(async () => {
      const res = await updateWorkingHoursAction(host.id, hours, bufferBefore, bufferAfter);
      if (res.error) setError(res.error);
      else {
        setSavedMsg("saved");
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-md border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">
            {host.display_name}{" "}
            <span className="text-xs text-muted-foreground font-normal">
              {host.email} · {host.timezone}
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1">
            buffer before
            <Input
              type="number"
              value={bufferBefore}
              onChange={(e) => setBufferBefore(Number(e.target.value))}
              className="w-16 h-7"
            />
            min
          </label>
          <label className="flex items-center gap-1">
            buffer after
            <Input
              type="number"
              value={bufferAfter}
              onChange={(e) => setBufferAfter(Number(e.target.value))}
              className="w-16 h-7"
            />
            min
          </label>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {DAYS.map((d) => {
          const ranges = hours[d.key] ?? [];
          return (
            <div key={d.key} className="flex items-start gap-3">
              <div className="w-24 text-sm pt-1.5 text-muted-foreground">{d.label}</div>
              <div className="flex-1 space-y-1">
                {ranges.length === 0 && (
                  <div className="text-xs text-muted-foreground italic pt-1.5">closed</div>
                )}
                {ranges.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={r[0]}
                      onChange={(e) => updateDay(d.key, i, 0, e.target.value)}
                      className="w-28 h-8"
                    />
                    <span className="text-muted-foreground text-xs">to</span>
                    <Input
                      type="time"
                      value={r[1]}
                      onChange={(e) => updateDay(d.key, i, 1, e.target.value)}
                      className="w-28 h-8"
                    />
                    <button
                      type="button"
                      onClick={() => removeRange(d.key, i)}
                      className="text-xs text-red-400 hover:text-red-500"
                    >
                      remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addRange(d.key)}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                >
                  + add range
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "saving…" : "save working hours"}
        </Button>
        {savedMsg && <span className="text-xs text-green-500">{savedMsg}</span>}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>

      <OverridesSection hostId={host.id} overrides={overrides} />
    </section>
  );
}

function OverridesSection({
  hostId,
  overrides,
}: {
  hostId: string;
  overrides: AvailabilityOverride[];
}) {
  const router = useRouter();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [kind, setKind] = useState<"block" | "extra">("block");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    if (!start || !end) {
      setError("start and end required");
      return;
    }
    startTransition(async () => {
      const res = await addOverrideAction({
        hostId,
        startIso: new Date(start).toISOString(),
        endIso: new Date(end).toISOString(),
        kind,
        reason: reason || undefined,
      });
      if (res.error) setError(res.error);
      else {
        setStart("");
        setEnd("");
        setReason("");
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteOverrideAction(id);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="mt-6 pt-5 border-t">
      <h3 className="text-sm font-medium mb-3">overrides</h3>
      {overrides.length === 0 ? (
        <p className="text-xs text-muted-foreground mb-4">no overrides set.</p>
      ) : (
        <ul className="space-y-1 mb-4">
          {overrides.map((o) => {
            let range = o.during;
            try {
              const r = parseTstzrange(o.during);
              range = `${r.start.toLocaleString()} – ${r.end.toLocaleString()}`;
            } catch {
              // keep raw
            }
            return (
              <li key={o.id} className="flex items-center justify-between text-xs">
                <span>
                  <span className="font-mono text-muted-foreground mr-2">[{o.kind}]</span>
                  {range}
                  {o.reason && (
                    <span className="text-muted-foreground ml-2">— {o.reason}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => remove(o.id)}
                  className="text-red-400 hover:text-red-500"
                >
                  remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2 text-xs">
        <label>
          <div className="text-muted-foreground mb-1">start</div>
          <Input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="h-8"
          />
        </label>
        <label>
          <div className="text-muted-foreground mb-1">end</div>
          <Input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="h-8"
          />
        </label>
        <label>
          <div className="text-muted-foreground mb-1">kind</div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "block" | "extra")}
            className="h-8 rounded border bg-background px-2"
          >
            <option value="block">block</option>
            <option value="extra">extra</option>
          </select>
        </label>
        <label className="flex-1 min-w-[200px]">
          <div className="text-muted-foreground mb-1">reason (optional)</div>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-8"
          />
        </label>
        <Button size="sm" onClick={add} disabled={pending}>
          {pending ? "adding…" : "add override"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
