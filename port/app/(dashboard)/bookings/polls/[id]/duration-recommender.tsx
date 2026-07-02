"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";

interface PollOption {
  id: string;
  starts_at: string;
  ends_at: string;
}

interface PollResponse {
  id: string;
  respondent_name: string;
}

interface PollResponseChoice {
  response_id: string;
  option_id: string;
  availability: "yes" | "if_need_be" | "no";
}

interface WindowResult {
  startsAt: string;
  durationMin: number;
  yes: number;
  yesOrMaybe: number;
  total: number;
  names: { name: string; availability: string }[];
}

function formatWindow(startsAt: string, durationMin: number): string {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMin * 60000);
  const tz = "America/Los_Angeles";
  const date = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz,
  });
  const t1 = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
  const t2 = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
  return `${date} · ${t1}–${t2}`;
}

function computeWindows(
  options: PollOption[],
  responses: PollResponse[],
  choices: PollResponseChoice[],
  durationMin: number,
): WindowResult[] {
  const n = durationMin / 30;
  if (options.length < n || responses.length === 0) return [];

  const sorted = [...options].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );

  // Index choices by option_id
  const choicesByOption = new Map<string, PollResponseChoice[]>();
  for (const c of choices) {
    if (!choicesByOption.has(c.option_id)) choicesByOption.set(c.option_id, []);
    choicesByOption.get(c.option_id)!.push(c);
  }
  const responseById = new Map(responses.map((r) => [r.id, r]));

  const results: WindowResult[] = [];

  for (let i = 0; i <= sorted.length - n; i++) {
    // Check that slots i..i+n-1 are consecutive (each starts exactly when prev ends)
    let valid = true;
    for (let j = 1; j < n; j++) {
      if (
        new Date(sorted[i + j].starts_at).getTime() !==
        new Date(sorted[i + j - 1].ends_at).getTime()
      ) {
        valid = false;
        break;
      }
    }
    if (!valid) continue;

    const chain = sorted.slice(i, i + n);

    // Intersect: who can make ALL slots in chain (yes/if_need_be)?
    let yesAll = new Set(responses.map((r) => r.id));
    let maybeAll = new Set(responses.map((r) => r.id));

    for (const opt of chain) {
      const optChoices = choicesByOption.get(opt.id) ?? [];
      const yesIds = new Set(
        optChoices.filter((c) => c.availability === "yes").map((c) => c.response_id),
      );
      const maybeIds = new Set(
        optChoices
          .filter((c) => c.availability === "yes" || c.availability === "if_need_be")
          .map((c) => c.response_id),
      );
      for (const id of [...yesAll]) {
        if (!yesIds.has(id)) yesAll.delete(id);
      }
      for (const id of [...maybeAll]) {
        if (!maybeIds.has(id)) maybeAll.delete(id);
      }
    }

    const names: { name: string; availability: string }[] = [];
    for (const id of yesAll) {
      const r = responseById.get(id);
      if (r) names.push({ name: r.respondent_name, availability: "yes" });
    }
    for (const id of maybeAll) {
      if (!yesAll.has(id)) {
        const r = responseById.get(id);
        if (r) names.push({ name: r.respondent_name, availability: "if_need_be" });
      }
    }

    results.push({
      startsAt: chain[0].starts_at,
      durationMin,
      yes: yesAll.size,
      yesOrMaybe: maybeAll.size,
      total: responses.length,
      names,
    });
  }

  return results.sort((a, b) => b.yes - a.yes || b.yesOrMaybe - a.yesOrMaybe);
}

interface Props {
  options: PollOption[];
  responses: PollResponse[];
  choices: PollResponseChoice[];
}

export function DurationRecommender({ options, responses, choices }: Props) {
  const [durationMin, setDurationMin] = useState(60);

  const windows = useMemo(
    () => computeWindows(options, responses, choices, durationMin),
    [options, responses, choices, durationMin],
  );

  if (responses.length === 0) return null;

  const DURATIONS = [30, 60, 90, 120];

  return (
    <div className="mt-8 border-t pt-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-sm font-medium">find a window</h2>
        <p className="text-xs text-muted-foreground">how many people can make a continuous block?</p>
        <div className="flex gap-1 ml-auto">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDurationMin(d)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                durationMin === d
                  ? "bg-foreground text-background font-medium"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {d}m
            </button>
          ))}
        </div>
      </div>

      {windows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          no consecutive {durationMin}-minute windows found — the candidate slots may not be long
          enough, or gaps exist between slots.
        </p>
      ) : (
        <div className="space-y-2">
          {windows.slice(0, 6).map((w, i) => (
            <div
              key={w.startsAt}
              className={`rounded-md border p-3 ${
                i === 0 && w.yes > 0
                  ? "border-green-400/60 bg-green-50/10 dark:bg-green-950/10"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{formatWindow(w.startsAt, durationMin)}</div>
                  <div className="flex gap-4 mt-1.5 text-xs">
                    <span className="text-green-600 dark:text-green-400">
                      ✓ {w.yes}/{w.total} yes
                    </span>
                    {w.yesOrMaybe > w.yes && (
                      <span className="text-amber-600 dark:text-amber-400">
                        ~ {w.yesOrMaybe - w.yes} if needed
                      </span>
                    )}
                    <span className="text-muted-foreground">✗ {w.total - w.yesOrMaybe} no</span>
                  </div>
                  {w.names.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {w.names.map((n, j) => (
                        <span
                          key={j}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs border ${
                            n.availability === "yes"
                              ? "border-green-300 text-green-700 dark:text-green-400"
                              : "border-amber-300 text-amber-700 dark:text-amber-400"
                          }`}
                        >
                          {n.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {i === 0 && w.yes > 0 && (
                  <Badge
                    variant="outline"
                    className="shrink-0 text-xs border-green-400 text-green-700 dark:text-green-400"
                  >
                    best fit
                  </Badge>
                )}
              </div>
            </div>
          ))}
          {windows.length > 6 && (
            <p className="text-xs text-muted-foreground">
              +{windows.length - 6} more windows — top 6 shown
            </p>
          )}
        </div>
      )}
    </div>
  );
}
