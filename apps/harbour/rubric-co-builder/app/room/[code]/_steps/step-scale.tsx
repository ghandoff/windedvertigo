"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Criterion, Scale, ScaleResponse } from "@/lib/types";
import { SCALE_LEVELS } from "@/lib/types";
import { apiPath } from "@/lib/paths";

type Props = {
  code: string;
  criteria: Criterion[];
  scales: Scale[];
  scaleResponses: ScaleResponse[];
  participantId: string | null;
  canEdit: boolean;
};

export function StepScale({ code, criteria, scales, scaleResponses, participantId, canEdit }: Props) {
  const selected = useMemo(
    () => criteria.filter((c) => c.status === "selected").sort((a, b) => a.position - b.position),
    [criteria],
  );

  // derive unique participant ids from scale responses for column display (host view)
  const participantIds = useMemo(() => {
    const ids = new Set<string>();
    for (const sr of scaleResponses) ids.add(sr.participant_id);
    return [...ids];
  }, [scaleResponses]);

  return (
    <div className="space-y-8">
      <header className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-bold">write the scale.</h1>
        <p className="text-[color:var(--color-cadet)]/85 leading-relaxed">
          four levels for each criterion — novice, emerging, proficient, advanced. write
          your own version of what each level looks like. your input appears in your column.
          {!participantId
            ? " the facilitator sees all responses side by side."
            : " after everyone writes, you'll vote on the best descriptor for each level."}
        </p>
      </header>

      <div className="space-y-8">
        {selected.map((c) => (
          <ScaleBlock
            key={c.id}
            code={code}
            criterion={c}
            scales={scales.filter((s) => s.criterion_id === c.id)}
            scaleResponses={scaleResponses.filter((sr) => sr.criterion_id === c.id)}
            participantId={participantId}
            participantIds={participantIds}
            canEdit={canEdit}
          />
        ))}
        {selected.length === 0 ? (
          <p className="text-[color:var(--color-cadet)]/60">
            no criteria selected yet. the host needs to tally votes before this step
            has anything to show.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ScaleBlock({
  code,
  criterion,
  scales,
  scaleResponses,
  participantId,
  participantIds,
  canEdit,
}: {
  code: string;
  criterion: Criterion;
  scales: Scale[];
  scaleResponses: ScaleResponse[];
  participantId: string | null;
  participantIds: string[];
  canEdit: boolean;
}) {
  const isHost = participantId === null;

  return (
    <section className="rounded-lg border border-[color:var(--color-cadet)]/15 bg-white p-5">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-[color:var(--color-cadet)]">
          {criterion.name}
        </h2>
        {criterion.good_description ? (
          <p className="text-sm text-[color:var(--color-cadet)]/70 leading-relaxed">
            {criterion.good_description}
          </p>
        ) : null}
      </div>

      {isHost && participantIds.length > 0 ? (
        // host sees all student columns side by side
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left text-xs tracking-wider text-[color:var(--color-cadet)]/60 pb-2 pr-4 w-24">
                  level
                </th>
                {participantIds.map((pid, i) => (
                  <th
                    key={pid}
                    className="text-left text-xs tracking-wider text-[color:var(--color-cadet)]/60 pb-2 px-2"
                  >
                    student {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCALE_LEVELS.map(({ level, label }) => (
                <tr key={level} className="border-t border-[color:var(--color-cadet)]/10">
                  <td className="py-2 pr-4 text-xs tracking-wider text-[color:var(--color-cadet)]/60 align-top">
                    {level} · {label}
                  </td>
                  {participantIds.map((pid) => {
                    const sr = scaleResponses.find(
                      (r) => r.participant_id === pid && r.level === level,
                    );
                    return (
                      <td
                        key={pid}
                        className="py-2 px-2 align-top text-xs leading-relaxed text-[color:var(--color-cadet)]/85 max-w-xs"
                      >
                        {sr?.descriptor ? (
                          <span className="whitespace-pre-wrap">{sr.descriptor}</span>
                        ) : (
                          <span className="opacity-30">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : isHost ? (
        // host view, no student responses yet
        <p className="text-xs text-[color:var(--color-cadet)]/50 italic">
          waiting for student responses…
        </p>
      ) : (
        // student view: canonical scale cells they can edit
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {SCALE_LEVELS.map(({ level, label }) => {
            const scale = scales.find((s) => s.level === level);
            const myResponse = scaleResponses.find(
              (sr) => sr.level === level && sr.participant_id === participantId,
            );
            return (
              <ScaleCell
                key={level}
                code={code}
                criterionId={criterion.id}
                level={level}
                label={label}
                canonicalDescriptor={scale?.descriptor ?? ""}
                myDescriptor={myResponse?.descriptor ?? ""}
                participantId={participantId}
                canEdit={canEdit}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function ScaleCell({
  code,
  criterionId,
  level,
  label,
  canonicalDescriptor,
  myDescriptor,
  participantId,
  canEdit,
}: {
  code: string;
  criterionId: string;
  level: 1 | 2 | 3 | 4;
  label: string;
  canonicalDescriptor: string;
  myDescriptor: string;
  participantId: string | null;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(myDescriptor ?? "");
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!dirtyRef.current) {
      setValue(myDescriptor ?? "");
    }
  }, [myDescriptor]);

  async function save() {
    if (!canEdit || !participantId) return;
    setSaving(true);
    try {
      await fetch(apiPath(`/api/rooms/${code}/scale-responses`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participant_id: participantId,
          criterion_id: criterionId,
          level,
          descriptor: value,
        }),
      });
    } finally {
      setSaving(false);
      dirtyRef.current = false;
    }
  }

  return (
    <div className="rounded bg-[color:var(--color-champagne)]/40 p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs tracking-wider text-[color:var(--color-cadet)]/60">
          {level} · {label}
        </p>
        {saving ? (
          <span className="text-xs text-[color:var(--color-cadet)]/50">saving…</span>
        ) : null}
      </div>
      {canEdit ? (
        <textarea
          value={value}
          onChange={(e) => { dirtyRef.current = true; setValue(e.target.value); }}
          onBlur={save}
          rows={5}
          maxLength={600}
          placeholder={canonicalDescriptor || "describe this level…"}
          className="w-full text-sm leading-relaxed bg-white rounded p-2 border border-transparent focus:border-[color:var(--color-cadet)]/30 focus:outline-none resize-none placeholder:text-[color:var(--color-cadet)]/30 placeholder:italic"
        />
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-[color:var(--color-cadet)]/85">
          {value || <span className="opacity-50">—</span>}
        </p>
      )}
    </div>
  );
}
