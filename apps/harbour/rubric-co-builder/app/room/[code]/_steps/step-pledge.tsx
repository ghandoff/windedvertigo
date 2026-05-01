"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AiUseProposal,
  AiUseProposalVote,
  AiUseVote,
  PledgeResponse,
  PledgeSlot,
  PledgeSlotIndex,
} from "@/lib/types";
import { PLEDGE_SLOTS } from "@/lib/types";
import { apiPath } from "@/lib/paths";
import {
  computeCeiling,
  computeCeilingFromProposals,
  levelMeta,
} from "@/lib/ai-contract";

type Props = {
  code: string;
  slots: PledgeSlot[];
  votes: AiUseVote[];
  proposals?: AiUseProposal[];
  proposalVotes?: AiUseProposalVote[];
  participantId: string | null;
  pledgeResponses: PledgeResponse[];
  participantsCount: number;
};

export function StepPledge({
  code,
  slots,
  votes,
  proposals,
  proposalVotes,
  participantId,
  pledgeResponses,
  participantsCount,
}: Props) {
  const useProposals = (proposals?.length ?? 0) > 0;
  const { ceiling } = useProposals
    ? computeCeilingFromProposals(proposals ?? [], proposalVotes ?? [])
    : computeCeiling(votes);
  const rung = levelMeta(ceiling);

  const participantIds = [...new Set(pledgeResponses.map((pr) => pr.participant_id))].sort();

  return (
    <div className="space-y-6">
      <header className="space-y-3 max-w-3xl">
        <p className="text-xs tracking-widest text-[color:var(--color-cadet)]/70">
          step 5.5b — integrity pledge
        </p>
        <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-cadet)] text-white px-4 py-2 text-sm">
          <span className="font-bold">ceiling · level {ceiling}</span>
          <span className="opacity-80">— {rung.name}</span>
        </div>
        <h1 className="text-3xl font-bold">write the pledge.</h1>
        <p className="text-[color:var(--color-cadet)]/85 leading-relaxed">
          four slots. fill them in your own words. the ceiling above is the lid —
          nothing in the pledge can push past it.
          {participantId
            ? " after everyone writes, you'll vote on the best wording for each slot."
            : " the facilitator sees all responses side by side."}
        </p>
        {!participantId && (
          <p className="text-sm text-[color:var(--color-cadet)]/60">
            {pledgeResponses.length} response{pledgeResponses.length === 1 ? "" : "s"} across{" "}
            {participantsCount} participant{participantsCount === 1 ? "" : "s"}.
          </p>
        )}
      </header>

      {participantId ? (
        // student view: per-student blank-slate entry
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PLEDGE_SLOTS.map((meta) => {
            const myResponse = pledgeResponses.find(
              (pr) => pr.slot_index === meta.index && pr.participant_id === participantId,
            );
            return (
              <PledgeResponseCell
                key={meta.index}
                code={code}
                index={meta.index}
                label={meta.label}
                placeholder={meta.placeholder}
                myContent={myResponse?.content ?? ""}
                participantId={participantId}
              />
            );
          })}
        </div>
      ) : participantIds.length > 0 ? (
        // host view: table of all student responses per slot
        <div className="space-y-4">
          {PLEDGE_SLOTS.map((meta) => {
            const slotResponses = pledgeResponses.filter((pr) => pr.slot_index === meta.index);
            return (
              <div
                key={meta.index}
                className="rounded-lg border border-[color:var(--color-cadet)]/15 bg-white p-4"
              >
                <p className="text-sm font-semibold text-[color:var(--color-cadet)] mb-3">
                  {meta.label}
                </p>
                {slotResponses.length === 0 ? (
                  <p className="text-xs text-[color:var(--color-cadet)]/40 italic">
                    no responses yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {slotResponses.map((pr, i) => (
                      <div
                        key={pr.id}
                        className="rounded bg-[color:var(--color-champagne)]/40 p-3 text-sm"
                      >
                        <p className="text-xs tracking-wider text-[color:var(--color-cadet)]/55 mb-1">
                          student {participantIds.indexOf(pr.participant_id) + 1 || i + 1}
                        </p>
                        <p className="leading-relaxed whitespace-pre-wrap text-[color:var(--color-cadet)]/85">
                          {pr.content || <span className="opacity-40">—</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // host view, no responses yet — also show canonical slots for context
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PLEDGE_SLOTS.map((meta) => {
            const slot = slots.find((s) => s.slot_index === meta.index);
            return (
              <div
                key={meta.index}
                className="rounded-lg bg-white border border-[color:var(--color-cadet)]/15 p-4 flex flex-col gap-2"
              >
                <p className="text-sm font-semibold text-[color:var(--color-cadet)]">
                  {meta.label}
                </p>
                <p className="bg-[color:var(--color-champagne)]/40 rounded p-3 text-sm leading-relaxed text-[color:var(--color-cadet)]/60 min-h-[5rem] italic">
                  {slot?.content || "waiting for student responses…"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PledgeResponseCell({
  code,
  index,
  label,
  placeholder,
  myContent,
  participantId,
}: {
  code: string;
  index: PledgeSlotIndex;
  label: string;
  placeholder: string;
  myContent: string;
  participantId: string;
}) {
  const [value, setValue] = useState(myContent ?? "");
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!dirtyRef.current) {
      setValue(myContent ?? "");
    }
  }, [myContent]);

  async function save() {
    if (!participantId) return;
    setSaving(true);
    try {
      await fetch(apiPath(`/api/rooms/${code}/pledge-responses`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participant_id: participantId,
          slot_index: index,
          content: value,
        }),
      });
    } finally {
      setSaving(false);
      dirtyRef.current = false;
    }
  }

  return (
    <div className="rounded-lg bg-white border border-[color:var(--color-cadet)]/15 p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor={`pledge-slot-${index}`}
          className="text-sm font-semibold text-[color:var(--color-cadet)]"
        >
          {label}
        </label>
        {saving ? (
          <span className="text-xs text-[color:var(--color-cadet)]/50">saving…</span>
        ) : null}
      </div>
      <textarea
        id={`pledge-slot-${index}`}
        value={value}
        onChange={(e) => {
          dirtyRef.current = true;
          setValue(e.target.value);
        }}
        onBlur={save}
        rows={4}
        maxLength={800}
        placeholder={placeholder}
        className="w-full bg-[color:var(--color-champagne)]/40 rounded p-3 text-sm leading-relaxed placeholder:text-[color:var(--color-cadet)]/40 placeholder:italic focus:bg-white focus:outline-none border border-transparent focus:border-[color:var(--color-cadet)]/30 resize-none"
      />
    </div>
  );
}
