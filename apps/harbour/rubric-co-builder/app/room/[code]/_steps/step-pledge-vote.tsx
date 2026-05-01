"use client";

import { useMemo } from "react";
import type { PledgeResponse, PledgeResponseVote } from "@/lib/types";
import { PLEDGE_SLOTS } from "@/lib/types";
import { apiPath } from "@/lib/paths";

type Props = {
  code: string;
  pledgeResponses: PledgeResponse[];
  pledgeResponseVotes: PledgeResponseVote[];
  participantId: string | null;
  participantsCount: number;
};

export function StepPledgeVote({
  code,
  pledgeResponses,
  pledgeResponseVotes,
  participantId,
  participantsCount,
}: Props) {
  const participantLabel = useMemo(() => {
    const ids = [...new Set(pledgeResponses.map((pr) => pr.participant_id))].sort();
    const m = new Map<string, string>();
    ids.forEach((id, i) => m.set(id, `student ${i + 1}`));
    return m;
  }, [pledgeResponses]);

  const myVotes = useMemo(
    () =>
      participantId
        ? pledgeResponseVotes.filter((v) => v.participant_id === participantId)
        : [],
    [pledgeResponseVotes, participantId],
  );
  const myVoteSet = useMemo(
    () => new Set(myVotes.map((v) => v.pledge_response_id)),
    [myVotes],
  );

  const countsByResponse = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of pledgeResponseVotes) {
      m.set(v.pledge_response_id, (m.get(v.pledge_response_id) ?? 0) + 1);
    }
    return m;
  }, [pledgeResponseVotes]);

  async function toggle(pr: PledgeResponse) {
    if (!participantId) return;
    const already = myVoteSet.has(pr.id);
    if (already) {
      await fetch(
        apiPath(
          `/api/rooms/${code}/pledge-response-votes?participant_id=${participantId}&pledge_response_id=${pr.id}`,
        ),
        { method: "DELETE" },
      );
    } else {
      await fetch(apiPath(`/api/rooms/${code}/pledge-response-votes`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participant_id: participantId,
          pledge_response_id: pr.id,
        }),
      });
    }
  }

  return (
    <div className="space-y-8">
      <header className="max-w-3xl space-y-3">
        <p className="text-xs tracking-widest text-[color:var(--color-cadet)]/60 uppercase">
          pledge vote — pick the wording that fits
        </p>
        <h1 className="text-3xl font-bold">which pledge wording should we use?</h1>
        <p className="text-[color:var(--color-cadet)]/85 leading-relaxed">
          for each slot, your classmates wrote their own version. drop a dot on every
          version that feels right — as many as you want. the most-voted version per
          slot wins when the host taps <em>tally</em>.
        </p>
        {participantId ? (
          <p className="text-sm text-[color:var(--color-cadet)]/70">
            you&apos;ve dropped {myVotes.length} dot{myVotes.length === 1 ? "" : "s"} ·{" "}
            {participantsCount} participant{participantsCount === 1 ? "" : "s"} in the room
          </p>
        ) : (
          <p className="text-sm text-[color:var(--color-cadet)]/60">
            you&apos;re watching — voting is off on the host view.
          </p>
        )}
      </header>

      <div className="space-y-8">
        {PLEDGE_SLOTS.map((meta) => {
          const responses = pledgeResponses
            .filter((pr) => pr.slot_index === meta.index && pr.content.trim().length > 0)
            .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
          return (
            <section
              key={meta.index}
              className="rounded-lg border border-[color:var(--color-cadet)]/15 bg-white p-5"
            >
              <p className="text-sm font-semibold text-[color:var(--color-cadet)] mb-4">
                {meta.label}
              </p>
              {responses.length === 0 ? (
                <p className="text-xs text-[color:var(--color-cadet)]/40 italic">
                  no student responses yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {responses.map((pr) => {
                    const mine = myVoteSet.has(pr.id);
                    const count = countsByResponse.get(pr.id) ?? 0;
                    const ownResponse = pr.participant_id === participantId;
                    return (
                      <button
                        key={pr.id}
                        disabled={!participantId}
                        onClick={() => toggle(pr)}
                        aria-pressed={mine}
                        className={[
                          "group relative text-left rounded-lg bg-white p-4 transition-all",
                          mine
                            ? "ring-2 ring-[color:var(--color-sienna)] shadow-sm"
                            : "border border-[color:var(--color-cadet)]/15 hover:border-[color:var(--color-cadet)]/40",
                          count >= 1
                            ? "bg-gradient-to-br from-white to-[color:var(--color-champagne)]/60"
                            : "",
                          !participantId ? "cursor-default" : "cursor-pointer",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs uppercase tracking-wider text-[color:var(--color-cadet)]/55">
                            {participantLabel.get(pr.participant_id) ?? "student"}
                            {ownResponse ? " · yours" : ""}
                          </span>
                          {mine ? (
                            <span className="text-xs uppercase tracking-wider bg-[color:var(--color-sienna)] text-white rounded px-2 py-0.5">
                              your dot
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-[color:var(--color-cadet)]/90">
                          {pr.content}
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
            </section>
          );
        })}
      </div>

      <p className="text-xs text-[color:var(--color-cadet)]/55 max-w-xl">
        when the host taps <em>tally</em>, the winning version for each slot locks in as
        the canonical pledge. ties break to the earliest response.
      </p>
    </div>
  );
}
