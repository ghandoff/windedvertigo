"use client";

import { useMemo } from "react";
import type {
  AiUseLevel,
  AiUseProposal,
  AiUseProposalVote,
  AiUseVote,
} from "@/lib/types";
import { AI_USE_LEVELS } from "@/lib/types";
import { apiPath } from "@/lib/paths";

type Props = {
  code: string;
  proposals: AiUseProposal[];
  proposalVotes: AiUseProposalVote[];
  // kept for legacy rooms that skipped the propose phase
  legacyVotes: AiUseVote[];
  participantId: string | null;
  participantsCount: number;
};

export function StepAiLadder({
  code,
  proposals,
  proposalVotes,
  legacyVotes,
  participantId,
  participantsCount,
}: Props) {
  const participantLabel = useMemo(() => {
    const ids = [...proposals.map((p) => p.participant_id)].sort();
    const m = new Map<string, string>();
    ids.forEach((id, i) => m.set(id, `student ${i + 1}`));
    return m;
  }, [proposals]);

  const myVote = useMemo(
    () =>
      participantId
        ? proposalVotes.find((v) => v.participant_id === participantId) ?? null
        : null,
    [proposalVotes, participantId],
  );

  const countsByProposal = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of proposalVotes) {
      m.set(v.proposal_id, (m.get(v.proposal_id) ?? 0) + 1);
    }
    return m;
  }, [proposalVotes]);

  const countsByLevel = useMemo(() => {
    const m: Record<AiUseLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const p of proposals) {
      m[p.level] += countsByProposal.get(p.id) ?? 0;
    }
    return m;
  }, [proposals, countsByProposal]);

  async function vote(proposalId: string) {
    if (!participantId) return;
    // one dot per student — replace previous pick
    if (myVote && myVote.proposal_id !== proposalId) {
      await fetch(
        apiPath(
          `/api/rooms/${code}/ai-proposal-votes?participant_id=${participantId}&proposal_id=${myVote.proposal_id}`,
        ),
        { method: "DELETE" },
      );
    }
    if (myVote && myVote.proposal_id === proposalId) {
      await fetch(
        apiPath(
          `/api/rooms/${code}/ai-proposal-votes?participant_id=${participantId}&proposal_id=${proposalId}`,
        ),
        { method: "DELETE" },
      );
      return;
    }
    await fetch(apiPath(`/api/rooms/${code}/ai-proposal-votes`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        participant_id: participantId,
        proposal_id: proposalId,
      }),
    });
  }

  const totalVotes = proposalVotes.length;

  if (proposals.length === 0) {
    return (
      <LegacyLadder
        code={code}
        votes={legacyVotes}
        participantId={participantId}
        participantsCount={participantsCount}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-10 items-start">
      <aside className="space-y-4 lg:sticky lg:top-4">
        <p className="text-xs tracking-widest text-[color:var(--color-cadet)]/70">
          step 5.5b — AI-use ladder · vote
        </p>
        <h1 className="text-3xl font-bold">which proposal sets the ceiling?</h1>
        <p className="text-[color:var(--color-cadet)]/85 leading-relaxed">
          each rung below lists the proposals posted by your classmates. drop your one
          dot on the proposal you&apos;d back — rationale, level, and all. the rung of
          the most-voted proposal becomes the class&apos; ceiling. ties break to the
          lower rung.
        </p>
        {participantId ? (
          <p className="text-sm text-[color:var(--color-cadet)]/70">
            {myVote
              ? "your dot is down. tap it again to take it back, or tap another to move it."
              : "tap a proposal to vote."}
          </p>
        ) : (
          <p className="text-sm text-[color:var(--color-cadet)]/60">
            you&apos;re watching — voting is off on the host view.
          </p>
        )}
        <p className="text-xs text-[color:var(--color-cadet)]/60">
          {totalVotes} of {Math.max(participantsCount, 1)} voted · {proposals.length}{" "}
          {proposals.length === 1 ? "proposal" : "proposals"} on the board
        </p>
      </aside>

      <section className="space-y-3 relative">
        <div
          aria-hidden
          className="absolute left-8 top-4 bottom-4 w-[2px] bg-[color:var(--color-cadet)]/20 rounded"
        />
        {[...AI_USE_LEVELS].reverse().map((rung) => {
          const rungProposals = proposals.filter((p) => p.level === rung.level);
          const rungCount = countsByLevel[rung.level];
          return (
            <div key={rung.level} className="relative z-10">
              <div className="flex items-start gap-4 rounded-lg p-4 bg-white border border-[color:var(--color-cadet)]/15">
                <div className="w-16 shrink-0 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-[color:var(--color-cadet)] text-white">
                    {rung.level}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[color:var(--color-cadet)]">
                    level {rung.level} — {rung.name}
                  </p>
                  <p className="text-sm text-[color:var(--color-cadet)]/80 mt-1 leading-relaxed">
                    {rung.helper}
                  </p>
                </div>
                <div className="w-20 shrink-0 flex flex-wrap items-start justify-end gap-1">
                  {Array.from({ length: rungCount }).map((_, i) => (
                    <span
                      key={i}
                      className="w-3 h-3 rounded-full bg-[color:var(--color-sienna)]"
                      aria-hidden
                    />
                  ))}
                  {rungCount === 0 ? (
                    <span className="text-xs text-[color:var(--color-cadet)]/40">
                      —
                    </span>
                  ) : null}
                </div>
              </div>

              {rungProposals.length > 0 ? (
                <ul className="mt-2 ml-20 space-y-2">
                  {rungProposals.map((p) => {
                    const mine = myVote?.proposal_id === p.id;
                    const count = countsByProposal.get(p.id) ?? 0;
                    return (
                      <li key={p.id}>
                        <button
                          disabled={!participantId}
                          onClick={() => vote(p.id)}
                          aria-pressed={mine}
                          className={[
                            "w-full text-left rounded-lg p-3 transition-all bg-white",
                            mine
                              ? "ring-2 ring-[color:var(--color-sienna)]"
                              : "border border-[color:var(--color-cadet)]/15 hover:border-[color:var(--color-cadet)]/40",
                            !participantId ? "cursor-default" : "cursor-pointer",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs uppercase tracking-wider text-[color:var(--color-cadet)]/55">
                              {participantLabel.get(p.participant_id) ?? "student"}
                              {p.participant_id === participantId ? " · yours" : ""}
                            </span>
                            <span className="flex items-center gap-1">
                              {Array.from({ length: count }).map((_, i) => (
                                <span
                                  key={i}
                                  className="w-2.5 h-2.5 rounded-full bg-[color:var(--color-sienna)]"
                                  aria-hidden
                                />
                              ))}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed text-[color:var(--color-cadet)]/90 whitespace-pre-wrap">
                            {p.rationale || (
                              <span className="italic opacity-60">
                                no rationale posted
                              </span>
                            )}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 ml-20 text-xs uppercase tracking-wider text-[color:var(--color-cadet)]/40">
                  no proposals on this rung
                </p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

// legacy single-vote ladder for rooms that were created before the propose phase.
function LegacyLadder({
  code,
  votes,
  participantId,
  participantsCount,
}: {
  code: string;
  votes: AiUseVote[];
  participantId: string | null;
  participantsCount: number;
}) {
  const counts = useMemo(() => {
    const m: Record<AiUseLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const v of votes) m[v.level]++;
    return m;
  }, [votes]);

  const myVote = useMemo(
    () =>
      participantId ? votes.find((v) => v.participant_id === participantId) ?? null : null,
    [votes, participantId],
  );

  async function cast(level: AiUseLevel) {
    if (!participantId) return;
    await fetch(apiPath(`/api/rooms/${code}/ai-votes`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ participant_id: participantId, level }),
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-10 items-start">
      <aside className="space-y-4 lg:sticky lg:top-4">
        <p className="text-xs tracking-widest text-[color:var(--color-cadet)]/70">
          step 5.5a — AI-use ladder (legacy)
        </p>
        <h1 className="text-3xl font-bold">how high does AI climb?</h1>
        <p className="text-[color:var(--color-cadet)]/85 leading-relaxed">
          pick the rung that feels right. one dot each. whichever rung gets the most
          dots becomes the class&apos; ceiling.
        </p>
        {participantId ? (
          <p className="text-sm">
            {myVote ? (
              <>
                you voted for{" "}
                <span className="font-semibold text-[color:var(--color-sienna)]">
                  level {myVote.level}
                </span>
                . tap another rung to change.
              </>
            ) : (
              <>tap a rung to cast your dot.</>
            )}
          </p>
        ) : (
          <p className="text-sm text-[color:var(--color-cadet)]/60">
            you&apos;re watching — voting is off on the host view.
          </p>
        )}
        <p className="text-xs text-[color:var(--color-cadet)]/60">
          {votes.length} of {Math.max(participantsCount, 1)}{" "}
          {participantsCount === 1 ? "person has" : "people have"} voted. ties break to
          the lower rung.
        </p>
      </aside>

      <section className="space-y-3 relative">
        <div
          aria-hidden
          className="absolute left-8 top-4 bottom-4 w-[2px] bg-[color:var(--color-cadet)]/20 rounded"
        />
        {[...AI_USE_LEVELS].reverse().map((rung) => {
          const mine = myVote?.level === rung.level;
          const rungCount = counts[rung.level];
          return (
            <button
              key={rung.level}
              disabled={!participantId}
              onClick={() => cast(rung.level)}
              aria-pressed={mine}
              className={[
                "w-full flex items-start gap-4 rounded-lg p-4 text-left transition-all relative z-10",
                "bg-white border border-[color:var(--color-cadet)]/15",
                mine ? "ring-2 ring-[color:var(--color-sienna)]" : "",
                participantId
                  ? "hover:border-[color:var(--color-cadet)]/40 cursor-pointer"
                  : "cursor-default",
              ].join(" ")}
            >
              <div className="w-16 shrink-0 flex flex-col items-center">
                <div
                  className={[
                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                    mine
                      ? "bg-[color:var(--color-sienna)] text-white"
                      : "bg-[color:var(--color-cadet)] text-white",
                  ].join(" ")}
                >
                  {rung.level}
                </div>
              </div>
              <div className="flex-1">
                <p className="font-bold text-[color:var(--color-cadet)]">
                  level {rung.level} — {rung.name}
                </p>
                <p className="text-sm text-[color:var(--color-cadet)]/80 mt-1 leading-relaxed">
                  {rung.helper}
                </p>
              </div>
              <div className="w-20 shrink-0 flex flex-wrap items-start justify-end gap-1">
                {Array.from({ length: rungCount }).map((_, i) => (
                  <span
                    key={i}
                    className="w-3 h-3 rounded-full bg-[color:var(--color-sienna)]"
                    aria-hidden
                  />
                ))}
                {rungCount === 0 ? (
                  <span className="text-xs text-[color:var(--color-cadet)]/40">
                    —
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </section>
    </div>
  );
}
