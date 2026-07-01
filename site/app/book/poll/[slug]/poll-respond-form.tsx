"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

export function PollRespondForm({ pollSlug, options, existingResponseCount }: Props) {
  const router = useRouter();
  const [tz, setTz] = useState("UTC");
  const [name, setName] = useState("");
  const [choices, setChoices] = useState<Record<string, Availability>>(() =>
    Object.fromEntries(options.map((o) => [o.id, "no" as Availability])),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  function setChoice(optionId: string, val: Availability) {
    setChoices((prev) => ({ ...prev, [optionId]: val }));
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
        <p className="text-xs text-muted-foreground">times shown in {tz}</p>
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
