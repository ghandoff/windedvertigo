"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

interface PollOption {
  id: string;
  starts_at: string;
  ends_at: string;
  sort_order: number;
}

type Availability = "yes" | "if_need_be" | "no";

interface Props {
  pollSlug: string;
  options: PollOption[];
  existingResponseCount: number;
}

function formatSlot(startsAt: string, endsAt: string, tz: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz });
  const t1 = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  const t2 = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  return `${date} · ${t1}–${t2}`;
}

const CHOICE_STYLES: Record<Availability, { active: string; idle: string; label: string }> = {
  yes: {
    active: "border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
    idle: "border-muted hover:border-green-400 text-muted-foreground hover:text-green-700",
    label: "yes",
  },
  if_need_be: {
    active: "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    idle: "border-muted hover:border-amber-400 text-muted-foreground hover:text-amber-700",
    label: "if need be",
  },
  no: {
    active: "border-slate-400 bg-slate-50 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400",
    idle: "border-muted hover:border-slate-400 text-muted-foreground hover:text-slate-600",
    label: "no",
  },
};

export function PollRespondForm({ pollSlug, options: initialOptions, existingResponseCount }: Props) {
  const router = useRouter();
  const [tz, setTz] = useState("UTC");
  const [name, setName] = useState("");
  const [options, setOptions] = useState<PollOption[]>(initialOptions);
  const [choices, setChoices] = useState<Record<string, Availability>>(() =>
    Object.fromEntries(initialOptions.map((o) => [o.id, "no" as Availability])),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Propose-a-slot state
  const [showPropose, setShowPropose] = useState(false);
  const [proposeStart, setProposeStart] = useState("");
  const [proposeEnd, setProposeEnd] = useState("");
  const [proposing, setProposing] = useState(false);
  const [proposeError, setProposeError] = useState<string | null>(null);

  useEffect(() => {
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  function setChoice(optionId: string, val: Availability) {
    setChoices((prev) => ({ ...prev, [optionId]: val }));
  }

  async function handleProposeSlot() {
    if (!proposeStart || !proposeEnd) { setProposeError("both start and end are required"); return; }
    setProposing(true);
    setProposeError(null);
    try {
      const res = await fetch(`/api/poll/${pollSlug}/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: new Date(proposeStart).toISOString(),
          endsAt: new Date(proposeEnd).toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; option?: PollOption; error?: string };
      if (!res.ok) throw new Error(data.error ?? "something went wrong");
      const newOption = data.option!;
      setOptions((prev) => [...prev, newOption]);
      // pre-select "yes" for the time the respondent just proposed
      setChoices((prev) => ({ ...prev, [newOption.id]: "yes" }));
      setProposeStart("");
      setProposeEnd("");
      setShowPropose(false);
    } catch (err) {
      setProposeError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setProposing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("please enter your name"); return; }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/poll/${pollSlug}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), choices }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "something went wrong");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="respondent-name" className="block text-xs text-muted-foreground mb-1">
          your name
        </label>
        <input
          id="respondent-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. jamie"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">times shown in {tz}</p>
          <button
            type="button"
            onClick={() => setShowPropose((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            suggest a time
          </button>
        </div>

        {options.map((opt) => {
          const current = choices[opt.id] ?? "no";
          return (
            <div key={opt.id} className="rounded-md border p-3">
              <div className="text-sm font-medium mb-2">
                {formatSlot(opt.starts_at, opt.ends_at, tz)}
              </div>
              <div className="flex gap-2">
                {(["yes", "if_need_be", "no"] as Availability[]).map((avail) => {
                  const styles = CHOICE_STYLES[avail];
                  const isActive = current === avail;
                  return (
                    <button
                      key={avail}
                      type="button"
                      onClick={() => setChoice(opt.id, avail)}
                      className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                        isActive ? styles.active : styles.idle
                      }`}
                    >
                      {styles.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {showPropose && (
          <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-3 space-y-3">
            <p className="text-xs font-medium text-primary">suggest another time</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1">start</label>
                <input
                  type="datetime-local"
                  value={proposeStart}
                  onChange={(e) => setProposeStart(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1">end</label>
                <input
                  type="datetime-local"
                  value={proposeEnd}
                  onChange={(e) => setProposeEnd(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
            {proposeError && <p className="text-xs text-destructive">{proposeError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleProposeSlot}
                disabled={proposing}
                className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {proposing ? "adding…" : "add to poll"}
              </button>
              <button
                type="button"
                onClick={() => { setShowPropose(false); setProposeError(null); }}
                className="rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
      >
        {submitting ? "saving…" : "submit availability"}
      </button>
    </form>
  );
}
