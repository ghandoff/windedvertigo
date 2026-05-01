"use client";

import { useMemo, useState } from "react";
import type {
  Criterion,
  ScaleResponse,
  ScaleResponseVote,
} from "@/lib/types";
import { SCALE_LEVELS } from "@/lib/types";
import { apiPath } from "@/lib/paths";

type Props = {
  code: string;
  criteria: Criterion[];
  scaleResponses: ScaleResponse[];
  scaleResponseVotes: ScaleResponseVote[];
  participantId: string | null;
  participantsCount: number;
};

export function StepScaleVote({
  code,
  criteria,
  scaleResponses,
  scaleResponseVotes,
  participantId,
  participantsCount,
}: Props) {
  const selected = useMemo(
    () =>
      criteria
        .filter((c) => c.status === "selected")
        .sort((a, b) => a.position - b.position),
    [criteria],
  );

  // anonymous stable labels: "student 1", "student 2", etc.
  const participantLabel = useMemo(() => {
    const ids = [...new Set(scaleResponses.map((sr) => sr.participant_id))].sort();
    const m = new Map<string, string>();
    ids.forEach((id, i) => m.set(id, `student ${i + 1}`));
    return m;
  }, [scaleResponses]);

  const myVotes = useMemo(
    () =>
      participantId
        ? scaleResponseVotes.filter((v) => v.participant_id === participantId)
        : [],
    [scaleResponseVotes, participantId],
  );
  const myVoteSet = useMemo(
    () => new Set(myVotes.map((v) => v.scale_response_id)),
    [myVotes],
  );

  const countsByResponse = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of scaleResponseVotes) {
      m.set(v.scale_response_id, (m.get(v.scale_response_id) ?? 0) + 1);
    }
    return m;
  }, [scaleResponseVotes]);

  const [voteError, setVoteError] = useState<string | null>(null);

  async function toggle(sr: ScaleResponse) {
    if (!participantId) return;
    setVoteError(null);
    const already = myVoteSet.has(sr.id);
    try {
      if (already) {
        const res = await fetch(
          apiPath(
            `/api/rooms/${code}/scale-response-votes?participant_id=${participantId}&scale_response_id=${sr.id}`,
          ),
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error(`${res.status}`);
      } else {
        const res = await fetch(apiPath(`/api/rooms/${code}/scale-response-votes`), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            participant_id: participantId,
            scale_response_id: sr.id,
          }),
        });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch {
      setVoteError("couldn't register your vote — the room might need a database update. try again shortly.");
    }
  }

  if (selected.length === 0) {
    return (
      <p className="text-[color:var(--color-cadet)]/60">
        no criteria selected yet. the host needs to tally round 1 before this ballot
        has anything to show.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <header className="max-w-3xl space-y-3">
        <p className="text-xs tracking-widest text-[color:var(--color-cadet)]/60 uppercase">
          round 2 — pick the wording that lands
        </p>
        <h1 className="text-3xl font-bold">which scale descriptors should we use?</h1>
        <p className="text-[color:var(--color-cadet)]/85 leading-relaxed">
          for each criterion and each level, your classmates wrote their own version of
          what that level looks like. drop a dot on every descriptor that feels right —
          as many as you want. the most-voted descriptor per level wins when the host
          taps <em>tally</em>.
        </p>
        {participantId ? (
          <p className="text-sm text-[color:var(--color-cadet)]/70">
            you&apos;ve dropped {myVotes.length} dot{myVotes.length === 1 ? "" : "s"} ·{" "}
            {participantsCount} participant{participantsCount === 1 ? "" : "s"} in the
            room
          </p>
        ) : (
          <p className="text-sm text-[color:var(--color-cadet)]/60">
            you&apos;re watching — voting is off on the host view.
          </p>
        )}
      </header>

      {voteError ? (
        <p className="text-sm text-[color:var(--color-sienna)] bg-[color:var(--color-sienna)]/10 rounded-lg px-4 py-3">
          {voteError}
        </p>
      ) : null}

      <div className="space-y-10">
        {selected.map((c) => (
          <section
            key={c.id}
            className="rounded-lg border border-[color:var(--color-cadet)]/15 bg-white p-5"
          >
            <div className="mb-4">
              <h2 className="text-xl font-bold text-[color:var(--color-cadet)]">
                {c.name}
              </h2>
              {c.good_description ? (
                <p className="text-sm text-[color:var(--color-cadet)]/70 leading-relaxed">
                  {c.good_description}
                </p>
              ) : null}
            </div>

            <div className="space-y-5">
              {SCALE_LEVELS.map(({ level, label }) => {
                const responses = scaleResponses
                  .filter(
                    (sr) =>
                      sr.criterion_id === c.id &&
                      sr.level === level &&
                      sr.descriptor.trim().length > 0,
                  )
                  .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
                return (
                  <div key={level}>
                    <p className="text-xs tracking-wider uppercase text-[color:var(--color-cadet)]/60 mb-2">
                      {level} · {label}
                    </p>
                    {responses.length === 0 ? (
                      <p className="text-xs text-[color:var(--color-cadet)]/40 italic">
                        no descriptors written yet — students need to fill in this level during the scale step.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {responses.map((sr) => {
                          const mine = myVoteSet.has(sr.id);
                          const count = countsByResponse.get(sr.id) ?? 0;
                          const hasVotes = count >= 1;
                          const ownDescriptor = sr.participant_id === participantId;
                          return (
                            <button
                              key={sr.id}
                              disabled={!participantId}
                              onClick={() => toggle(sr)}
                              aria-pressed={mine}
                              className={[
                                "group relative text-left rounded-lg bg-white p-4 transition-all",
                                mine
                                  ? "ring-2 ring-[color:var(--color-sienna)] shadow-sm"
                                  : "border border-[color:var(--color-cadet)]/15 hover:border-[color:var(--color-cadet)]/40",
                                hasVotes
                                  ? "bg-gradient-to-br from-white to-[color:var(--color-champagne)]/60"
                                  : "",
                                !participantId ? "cursor-default" : "cursor-pointer",
                              ].join(" ")}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs uppercase tracking-wider text-[color:var(--color-cadet)]/55">
                                  {participantLabel.get(sr.participant_id) ?? "student"}
                                  {ownDescriptor ? " · yours" : ""}
                                </span>
                                {mine ? (
                                  <span className="text-xs uppercase tracking-wider bg-[color:var(--color-sienna)] text-white rounded px-2 py-0.5">
                                    your dot
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap text-[color:var(--color-cadet)]/90">
                                {sr.descriptor}
                              </p>
                              <div className="flex items-center gap-1 mt-3 flex-wrap">
                                {Array.from({ length: count }).map((_, i) => (
                                  <span
                                    key={i}
                                    className="w-3 h-3 rounded-full bg-[color:var(--color-sienna)]"
                                    aria-hidden
                                  />
                                ))}
                                {count === 0 ? (
                                  <span className="text-xs text-[color:var(--color-cadet)]/40">
                                    no dots yet
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="text-xs text-[color:var(--color-cadet)]/55 max-w-xl">
        when the host taps <em>tally</em>, the winning descriptor for each (criterion,
        level) locks in as the canonical rubric text. ties break to the earliest
        descriptor.
      </p>
    </div>
  );
}
