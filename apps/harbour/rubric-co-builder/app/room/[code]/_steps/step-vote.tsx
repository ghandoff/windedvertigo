"use client";

import { useMemo, useState } from "react";
import type { Criterion, Scale, Vote } from "@/lib/types";
import { SCALE_LEVELS } from "@/lib/types";
import { apiPath } from "@/lib/paths";

// dot budget scales to the size of the ballot
function maxVotesFor(criteriaOnBallot: number): number {
  if (criteriaOnBallot <= 1) return 1;
  return Math.min(3, Math.max(1, criteriaOnBallot - 1));
}

type Props = {
  code: string;
  criteria: Criterion[];
  votes: Vote[];
  participantId: string | null;
  participantsCount: number;
  round: 1 | 2 | 3;
  scales?: Scale[];
};

export function StepVote({
  code,
  criteria,
  votes,
  participantId,
  participantsCount,
  round,
  scales,
}: Props) {
  const maxVotes = maxVotesFor(criteria.length);
  const [voteError, setVoteError] = useState<string | null>(null);

  // only look at votes for the current round
  const roundVotes = useMemo(() => votes.filter((v) => (v.round ?? 1) === round), [votes, round]);

  const myVotes = useMemo(
    () => (participantId ? roundVotes.filter((v) => v.participant_id === participantId) : []),
    [roundVotes, participantId],
  );
  const myCast = new Set(myVotes.map((v) => v.criterion_id));
  const dotsLeft = Math.max(0, maxVotes - myVotes.length);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of roundVotes) m.set(v.criterion_id, (m.get(v.criterion_id) ?? 0) + 1);
    return m;
  }, [roundVotes]);

  // all criteria with ≥1 vote are shown as "making the cut" — no threshold
  const totalParticipants = Math.max(1, participantsCount);
  const totalVotesCast = roundVotes.length;

  const roundLabel =
    round === 1
      ? "round 1 — after proposals"
      : round === 2
      ? "round 2 — after scaling"
      : "round 3 — final vote";

  async function toggle(criterion: Criterion) {
    if (!participantId) return;
    const already = myCast.has(criterion.id);
    setVoteError(null);
    try {
      if (already) {
        const res = await fetch(
          apiPath(
            `/api/rooms/${code}/votes?participant_id=${participantId}&criterion_id=${criterion.id}&round=${round}`,
          ),
          { method: "DELETE" },
        );
        if (!res.ok) setVoteError("the network blinked — try again.");
      } else {
        if (dotsLeft <= 0) return;
        const res = await fetch(apiPath(`/api/rooms/${code}/votes`), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            participant_id: participantId,
            criterion_id: criterion.id,
            round,
          }),
        });
        if (!res.ok) setVoteError("the network blinked — try again.");
      }
    } catch {
      setVoteError("the network blinked — try again.");
    }
  }

  return (
    <div className="space-y-8">
      <header className="max-w-3xl space-y-3">
        <p className="text-xs tracking-widest text-[color:var(--color-cadet)]/60 uppercase">
          {roundLabel}
        </p>
        <h1 className="text-3xl font-bold">
          which {maxVotes === 1 ? "one" : maxVotes === 2 ? "two" : "three"} matter{maxVotes === 1 ? "s" : ""} most?
        </h1>
        <p className="text-[color:var(--color-cadet)]/85 leading-relaxed">
          you have <strong>{maxVotes} dot{maxVotes === 1 ? "" : "s"}</strong>. drop{" "}
          {maxVotes === 1 ? "it" : "them"} on the criteria that should end up on the
          rubric. tap a card to add a dot, tap again to take it back. required
          criteria are locked in regardless of the vote.
        </p>
        {participantId ? (
          <p className="text-sm">
            <span className="font-semibold text-[color:var(--color-sienna)]">
              {dotsLeft}
            </span>{" "}
            dot{dotsLeft === 1 ? "" : "s"} left · {totalVotesCast} dot{totalVotesCast === 1 ? "" : "s"} cast across {totalParticipants} participant{totalParticipants === 1 ? "" : "s"}
          </p>
        ) : (
          <p className="text-sm text-[color:var(--color-cadet)]/60">
            you&apos;re watching — voting is off on the host view.
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {criteria.map((c) => {
          const count = counts.get(c.id) ?? 0;
          const mine = myCast.has(c.id);
          const hasVotes = c.required || count >= 1;
          const criterionScales = scales
            ? SCALE_LEVELS.flatMap(({ level, label }) => {
                const s = scales.find((sc) => sc.criterion_id === c.id && sc.level === level);
                return s ? [{ level, label, descriptor: s.descriptor }] : [];
              })
            : [];
          return (
            <button
              key={c.id}
              disabled={!participantId || (dotsLeft <= 0 && !mine)}
              onClick={() => toggle(c)}
              aria-pressed={mine}
              className={[
                "group relative text-left rounded-lg bg-white p-4 transition-all",
                mine
                  ? "ring-2 ring-[color:var(--color-sienna)] shadow-sm"
                  : "border border-[color:var(--color-cadet)]/15 hover:border-[color:var(--color-cadet)]/40",
                hasVotes ? "bg-gradient-to-br from-white to-[color:var(--color-champagne)]/60" : "",
                !participantId ? "cursor-default" : "cursor-pointer",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-[color:var(--color-cadet)]">
                  {c.name}
                </p>
                {c.required ? (
                  <span className="text-xs uppercase tracking-wider bg-[color:var(--color-cadet)] text-white rounded px-2 py-0.5">
                    required
                  </span>
                ) : null}
                {c.version_of ? (
                  <span className="text-xs uppercase tracking-wider bg-[color:var(--color-sienna)]/15 text-[color:var(--color-sienna)] rounded px-2 py-0.5">
                    variation
                  </span>
                ) : null}
              </div>
              {c.good_description ? (
                <p className="text-xs text-[color:var(--color-cadet)]/70 mt-1 leading-relaxed">
                  {c.good_description}
                </p>
              ) : null}

              {criterionScales.length > 0 ? (
                <div className="mt-3 pt-3 border-t border-[color:var(--color-cadet)]/10 space-y-2">
                  {criterionScales.map(({ level, label, descriptor }) => (
                    <div key={level} className="flex gap-2 text-xs leading-relaxed">
                      <span className="shrink-0 text-xs uppercase tracking-wider text-[color:var(--color-cadet)]/50 w-20 pt-0.5">
                        {level} · {label}
                      </span>
                      <span className="text-[color:var(--color-cadet)]/75">
                        {descriptor}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center gap-1 mt-4 flex-wrap">
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
                <span className="sr-only">{count} vote{count !== 1 ? "s" : ""}</span>
              </div>

              {hasVotes && !c.required ? (
                <p className="text-xs uppercase tracking-wider mt-2 text-[color:var(--color-cadet)] font-semibold">
                  making the cut
                </p>
              ) : null}
            </button>
          );
        })}
      </div>

      {voteError ? (
        <p role="alert" className="text-xs text-[color:var(--color-redwood)]">{voteError}</p>
      ) : null}

      <p className="text-xs text-[color:var(--color-cadet)]/55 max-w-xl">
        when the host taps <em>tally</em>, every criterion with at least one dot moves forward.
        required criteria are always included.
      </p>
    </div>
  );
}
