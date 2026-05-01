"use client";

import { useMemo, useState } from "react";
import type { AiUseLevel, AiUseProposal } from "@/lib/types";
import { AI_USE_LEVELS } from "@/lib/types";
import { apiPath } from "@/lib/paths";

type Props = {
  code: string;
  proposals: AiUseProposal[];
  participantId: string | null;
  participantsCount: number;
};

export function StepAiPropose({
  code,
  proposals,
  participantId,
  participantsCount,
}: Props) {
  const mine = useMemo(
    () =>
      participantId
        ? proposals.find((p) => p.participant_id === participantId) ?? null
        : null,
    [proposals, participantId],
  );

  const [level, setLevel] = useState<AiUseLevel | null>(mine?.level ?? null);
  const [rationale, setRationale] = useState<string>(mine?.rationale ?? "");
  const [saving, setSaving] = useState(false);

  async function save(nextLevel: AiUseLevel, nextRationale: string) {
    if (!participantId) return;
    setSaving(true);
    try {
      await fetch(apiPath(`/api/rooms/${code}/ai-proposals`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participant_id: participantId,
          level: nextLevel,
          rationale: nextRationale,
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  // anonymous labels for already-submitted proposals
  const participantLabel = useMemo(() => {
    const ids = [...proposals.map((p) => p.participant_id)].sort();
    const m = new Map<string, string>();
    ids.forEach((id, i) => m.set(id, `student ${i + 1}`));
    return m;
  }, [proposals]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-10 items-start">
      <aside className="space-y-4 lg:sticky lg:top-4">
        <p className="text-xs tracking-widest text-[color:var(--color-cadet)]/70">
          step 5.5a — AI-use ladder · propose
        </p>
        <h1 className="text-3xl font-bold">post a proposal.</h1>
        <p className="text-[color:var(--color-cadet)]/85 leading-relaxed">
          pick the rung that feels right for this project and say why, in one line.
          everyone else&apos;s proposals will come up on the next screen — you&apos;ll
          vote together on which one sets the class&apos; ceiling.
        </p>
        {participantId ? (
          <>
            <div className="space-y-2">
              <label className="text-xs tracking-widest uppercase text-[color:var(--color-cadet)]/70">
                your rationale
              </label>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                onBlur={() => {
                  if (level !== null && !saving) save(level, rationale);
                }}
                rows={4}
                maxLength={600}
                placeholder="one line on why this rung fits this project."
                className="w-full rounded-lg border border-[color:var(--color-cadet)]/20 bg-white px-4 py-3 text-sm leading-relaxed placeholder:text-[color:var(--color-cadet)]/40 focus:border-[color:var(--color-cadet)] focus:outline-none"
              />
            </div>
            <p className="text-xs text-[color:var(--color-cadet)]/55">
              {mine
                ? `saved — proposal on level ${mine.level}. tap a different rung to change.`
                : "pick a rung on the right to post."}
              {saving ? " · saving…" : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-[color:var(--color-cadet)]/60">
            you&apos;re watching — posting is off on the host view. {proposals.length} of{" "}
            {Math.max(participantsCount, 1)} posted so far.
          </p>
        )}
      </aside>

      <section className="space-y-3 relative">
        <div
          aria-hidden
          className="absolute left-8 top-4 bottom-4 w-[2px] bg-[color:var(--color-cadet)]/20 rounded"
        />
        {[...AI_USE_LEVELS].reverse().map((rung) => {
          const picked = level === rung.level;
          const rungProposals = proposals.filter((p) => p.level === rung.level);
          return (
            <div key={rung.level} className="relative z-10">
              <button
                disabled={!participantId}
                onClick={() => {
                  setLevel(rung.level);
                  save(rung.level, rationale);
                }}
                aria-pressed={picked}
                className={[
                  "w-full flex items-start gap-4 rounded-lg p-4 text-left transition-all",
                  "bg-white border border-[color:var(--color-cadet)]/15",
                  picked ? "ring-2 ring-[color:var(--color-sienna)]" : "",
                  participantId
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
                    {rungProposals.length}{" "}
                    {rungProposals.length === 1 ? "proposal" : "proposals"}
                  </span>
                </div>
              </button>

              {rungProposals.length > 0 ? (
                <ul className="mt-2 ml-20 space-y-1.5">
                  {rungProposals.map((p) => (
                    <li
                      key={p.id}
                      className="text-xs text-[color:var(--color-cadet)]/75 leading-relaxed"
                    >
                      <span className="text-[color:var(--color-cadet)]/50 mr-2">
                        {participantLabel.get(p.participant_id) ?? "student"}
                        {p.participant_id === participantId ? " · yours" : ""} —
                      </span>
                      {p.rationale ? (
                        <span className="whitespace-pre-wrap">{p.rationale}</span>
                      ) : (
                        <span className="italic opacity-60">no rationale yet</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </section>
    </div>
  );
}
