"use client";

import { useEffect, useState } from "react";

interface PollOption {
  id: string;
  starts_at: string;
  ends_at: string;
  sort_order: number;
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

interface Tally {
  option: PollOption;
  yes: number;
  if_need_be: number;
  no: number;
  respondents: { name: string; availability: "yes" | "if_need_be" | "no" }[];
  isBest: boolean;
}

interface Props {
  options: PollOption[];
  responses: PollResponse[];
  choices: PollResponseChoice[];
  lockedOptionId: string | null;
}

function computeTallies(options: PollOption[], responses: PollResponse[], choices: PollResponseChoice[]): Tally[] {
  const responseById = new Map(responses.map((r) => [r.id, r]));
  const byOption = new Map<string, PollResponseChoice[]>();
  for (const opt of options) byOption.set(opt.id, []);
  for (const c of choices) byOption.get(c.option_id)?.push(c);

  const tallies = options.map((opt) => {
    const cs = byOption.get(opt.id) ?? [];
    let yes = 0, if_need_be = 0, no = 0;
    const respondents: Tally["respondents"] = [];
    for (const c of cs) {
      if (c.availability === "yes") yes++;
      else if (c.availability === "if_need_be") if_need_be++;
      else no++;
      const r = responseById.get(c.response_id);
      if (r) respondents.push({ name: r.respondent_name, availability: c.availability });
    }
    return { option: opt, yes, if_need_be, no, respondents, isBest: false };
  });

  if (tallies.length > 0) {
    const best = tallies.reduce((a, b) =>
      b.yes > a.yes || (b.yes === a.yes && b.if_need_be > a.if_need_be) ? b : a,
    );
    if (best.yes + best.if_need_be > 0) best.isBest = true;
  }
  return tallies;
}

function formatSlot(startsAt: string, endsAt: string, tz: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz });
  const t1 = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  const t2 = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  return `${date} · ${t1}–${t2}`;
}

export function PollResultsGrid({ options, responses, choices, lockedOptionId }: Props) {
  const [tz, setTz] = useState("UTC");
  useEffect(() => {
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const tallies = computeTallies(options, responses, choices);

  if (responses.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">no responses yet — be the first!</p>
        {options.map((opt) => (
          <div key={opt.id} className="rounded-md border p-3 text-sm text-muted-foreground">
            {formatSlot(opt.starts_at, opt.ends_at, tz)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {responses.length} response{responses.length !== 1 ? "s" : ""} · times in your timezone ({tz})
      </p>
      {tallies.map((t) => {
        const isLocked = lockedOptionId === t.option.id;
        return (
          <div
            key={t.option.id}
            className={`rounded-md border p-3 ${
              isLocked
                ? "border-green-500 bg-green-50/30 dark:bg-green-950/20"
                : t.isBest && !lockedOptionId
                ? "border-green-400/50 bg-green-50/10 dark:bg-green-950/10"
                : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">{formatSlot(t.option.starts_at, t.option.ends_at, tz)}</div>
              <div className="flex gap-3 text-xs shrink-0">
                <span className="text-green-700 dark:text-green-400">✓ {t.yes}</span>
                <span className="text-amber-700 dark:text-amber-400">~ {t.if_need_be}</span>
                <span className="text-muted-foreground">✗ {t.no}</span>
              </div>
            </div>
            {t.respondents.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {t.respondents.map((r, i) => (
                  <span
                    key={i}
                    title={`${r.name}: ${r.availability.replace("_", " ")}`}
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${
                      r.availability === "yes"
                        ? "border-green-300 text-green-700 dark:text-green-400"
                        : r.availability === "if_need_be"
                        ? "border-amber-300 text-amber-700 dark:text-amber-400"
                        : "border-muted text-muted-foreground line-through"
                    }`}
                  >
                    {r.name}
                  </span>
                ))}
              </div>
            )}
            {isLocked && (
              <p className="mt-1 text-xs text-green-700 dark:text-green-400 font-medium">confirmed time ✓</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
