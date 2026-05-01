"use client";

import { useMemo, useState } from "react";
import type { CalibrationScore, Criterion, Room, Scale } from "@/lib/types";
import { SCALE_LEVELS } from "@/lib/types";
import { apiPath } from "@/lib/paths";
import {
  SAMPLE_ARTEFACT_CONTENT,
  SAMPLE_ARTEFACT_TITLE,
} from "@/content/sample-artefact";

type Props = {
  code: string;
  room: Room;
  criteria: Criterion[];
  scales: Scale[];
  scores: CalibrationScore[];
  participantId: string | null;
};

type Convergence = "none" | "strong" | "split" | "divergent";

function convergence(distribution: Map<number, number>, total: number): Convergence {
  if (total === 0) return "none";
  const maxLevel = [...distribution.entries()].sort((a, b) => b[1] - a[1])[0];
  const maxShare = maxLevel[1] / total;
  if (maxShare >= 0.8) return "strong";
  // split across adjacent levels?
  const touched = [...distribution.keys()].sort();
  const max = touched[touched.length - 1];
  const min = touched[0];
  if (max - min <= 1) return "split";
  return "divergent";
}

export function StepCalibrate({ code, room, criteria, scales, scores, participantId }: Props) {
  const selected = useMemo(
    () =>
      criteria
        .filter((c) => c.status === "selected")
        .sort((a, b) => a.position - b.position),
    [criteria],
  );
  // prefer per-room generated artefact; fall back to the stock student-consulting
  // proposal so older rooms still work. the stock one is intentionally uneven.
  const artefactTitle = room.sample_artefact_title ?? SAMPLE_ARTEFACT_TITLE;
  const artefactContent = room.sample_artefact_content ?? SAMPLE_ARTEFACT_CONTENT;

  async function score(criterionId: string, level: 1 | 2 | 3 | 4) {
    if (!participantId) return;
    await fetch(apiPath(`/api/rooms/${code}/calibration`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ participant_id: participantId, criterion_id: criterionId, level }),
    });
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-8 items-start">
      <aside className="space-y-4 xl:sticky xl:top-4">
        <p className="text-xs tracking-widest text-[color:var(--color-cadet)]/70">
          sample artefact
        </p>
        <h1 className="text-2xl font-bold">{artefactTitle}</h1>
        <div className="rounded-lg bg-white border border-[color:var(--color-cadet)]/15 p-5 max-h-[70vh] overflow-y-auto prose-artefact">
          {artefactContent.split("\n\n").map((para, i) => {
            if (para.startsWith("## ")) {
              return (
                <h3 key={i} className="text-base font-bold text-[color:var(--color-cadet)] mt-4 first:mt-0">
                  {para.replace(/^##\s*/, "")}
                </h3>
              );
            }
            return (
              <p key={i} className="text-sm leading-relaxed text-[color:var(--color-cadet)]/85 mt-3 first:mt-0">
                {para}
              </p>
            );
          })}
        </div>
      </aside>

      <section className="space-y-5">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">score the artefact.</h2>
          <p className="text-sm text-[color:var(--color-cadet)]/80 leading-relaxed">
            click the level that best fits for each criterion. cells colour themselves
            as the room converges — green when you agree, champagne when you split
            next door, redwood when you&apos;re apart. where it goes red, that&apos;s
            where the wording still needs work.
          </p>
        </div>

        <div className="space-y-3">
          {selected.map((c) => (
            <CalibrationRow
              key={c.id}
              criterion={c}
              scales={scales.filter((s) => s.criterion_id === c.id)}
              scores={scores.filter((s) => s.criterion_id === c.id)}
              myScore={
                participantId
                  ? scores.find(
                      (s) => s.criterion_id === c.id && s.participant_id === participantId,
                    ) ?? null
                  : null
              }
              onScore={(level) => score(c.id, level)}
              disabled={!participantId}
            />
          ))}
          {selected.length === 0 ? (
            <p className="text-[color:var(--color-cadet)]/60">
              no rubric yet. run the tally first.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function CalibrationRow({
  criterion,
  scales,
  scores,
  myScore,
  onScore,
  disabled,
}: {
  criterion: Criterion;
  scales: Scale[];
  scores: CalibrationScore[];
  myScore: CalibrationScore | null;
  onScore: (level: 1 | 2 | 3 | 4) => void;
  disabled: boolean;
}) {
  const distribution = new Map<number, number>();
  for (const s of scores) {
    distribution.set(s.level, (distribution.get(s.level) ?? 0) + 1);
  }
  const total = scores.length;
  const conv = convergence(distribution, total);

  const bg: Record<Convergence, string> = {
    none: "bg-white",
    strong: "bg-[color:var(--color-soft-green)]/40",
    split: "bg-[color:var(--color-champagne)]",
    divergent: "bg-[color:var(--color-redwood)]/30",
  };

  return (
    <div className={`rounded-lg border border-[color:var(--color-cadet)]/15 p-4 ${bg[conv]}`}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-lg font-bold text-[color:var(--color-cadet)]">{criterion.name}</h3>
        <p className="text-xs tracking-wider text-[color:var(--color-cadet)]/60">
          {total} score{total === 1 ? "" : "s"} · {conv}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {SCALE_LEVELS.map(({ level, label }) => {
          const scale = scales.find((s) => s.level === level);
          const votesAt = distribution.get(level) ?? 0;
          const mine = myScore?.level === level;
          return (
            <button
              key={level}
              disabled={disabled}
              onClick={() => onScore(level)}
              aria-pressed={mine}
              className={[
                "text-left rounded p-2 transition-all bg-white/70 hover:bg-white text-[color:var(--color-cadet)]",
                mine ? "ring-2 ring-[color:var(--color-sienna)]" : "ring-1 ring-transparent",
                disabled ? "cursor-default" : "cursor-pointer",
              ].join(" ")}
            >
              <p className="text-xs tracking-wider text-[color:var(--color-cadet)]/60">
                {level} · {label}
              </p>
              <p className="text-xs leading-snug mt-1 line-clamp-5">
                {scale?.descriptor || <span className="opacity-50">—</span>}
              </p>
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {Array.from({ length: votesAt }).map((_, i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-[color:var(--color-cadet)]"
                    aria-hidden
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {conv === "divergent" ? (
        <p className="text-xs mt-3 text-[color:var(--color-cadet)] italic">
          what language would have helped you score this the same?
        </p>
      ) : null}
    </div>
  );
}
