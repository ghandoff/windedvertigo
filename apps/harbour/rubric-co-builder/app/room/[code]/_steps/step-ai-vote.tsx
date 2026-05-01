"use client";

import { useMemo, useState } from "react";
import type { AiUseLevel, AiUseVote } from "@/lib/types";
import { AI_USE_LEVELS } from "@/lib/types";
import { apiPath } from "@/lib/paths";

type Props = {
  code: string;
  aiUseVotes: AiUseVote[];
  participantId: string | null;
  participantsCount: number;
};

export function StepAiVote({ code, aiUseVotes, participantId, participantsCount }: Props) {
  const myVote = useMemo(
    () => (participantId ? aiUseVotes.find((v) => v.participant_id === participantId) ?? null : null),
    [aiUseVotes, participantId],
  );

  const [selected, setSelected] = useState<AiUseLevel | null>(myVote?.level ?? null);
  const [saving, setSaving] = useState(false);

  const countsByLevel = useMemo(() => {
    const m = new Map<AiUseLevel, number>();
    for (const v of aiUseVotes) m.set(v.level, (m.get(v.level) ?? 0) + 1);
    return m;
  }, [aiUseVotes]);

  async function castVote(level: AiUseLevel) {
    if (!participantId || saving) return;
    setSelected(level);
    setSaving(true);
    try {
      await fetch(apiPath(`/api/rooms/${code}/ai-votes`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participant_id: participantId, level }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-10 items-start">
      <aside className="space-y-4 lg:sticky lg:top-4">
        <p className="text-xs tracking-widest text-[color:var(--color-cadet)]/70">
          final AI-use vote
        </p>
        <h1 className="text-3xl font-bold">vote for your rung.</h1>
        <p className="text-[color:var(--color-cadet)]/85 leading-relaxed">
          after the discussion, cast your final vote. the rung with the most votes
          becomes the class ceiling. ties break to the lower rung.
        </p>
        {participantId ? (
          <p className="text-xs text-[color:var(--color-cadet)]/55">
            {myVote
              ? `your vote is on level ${myVote.level}. tap a different rung to change.`
              : "tap a rung on the right to vote."}
            {saving ? " · saving…" : ""}
          </p>
        ) : (
          <p className="text-sm text-[color:var(--color-cadet)]/60">
            you&apos;re watching — voting is off on the host view.{" "}
            {aiUseVotes.length} of {Math.max(participantsCount, 1)} voted so far.
          </p>
        )}
      </aside>

      <section className="space-y-3 relative">
        <div
          aria-hidden
          className="absolute left-8 top-4 bottom-4 w-[2px] bg-[color:var(--color-cadet)]/20 rounded"
        />
        {[...AI_USE_LEVELS].reverse().map((rung) => {
          const picked = selected === rung.level;
          const count = countsByLevel.get(rung.level) ?? 0;
          return (
            <div key={rung.level} className="relative z-10">
              <button
                disabled={!participantId || saving}
                onClick={() => castVote(rung.level)}
                aria-pressed={picked}
                className={[
                  "w-full flex items-start gap-4 rounded-lg p-4 text-left transition-all",
                  "bg-white border border-[color:var(--color-cadet)]/15",
                  picked ? "ring-2 ring-[color:var(--color-sienna)]" : "",
                  participantId && !saving
                    ? "hover:border-[color:var(--color-cadet)]/40 cursor-pointer"
                    : "cursor-default",
                ].join(" ")}
              >
                <div className="w-16 shrink-0 flex flex-col items-center">
                  <div
                    className={[
                      "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                      picked
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
                <div className="w-20 shrink-0 text-right">
                  <span className="text-xs tracking-wider uppercase text-[color:var(--color-cadet)]/50">
                    {count} {count === 1 ? "vote" : "votes"}
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
