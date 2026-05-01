"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRoom } from "@/lib/use-room";
import { Wordmark } from "@/app/_components/wordmark";
import { apiPath } from "@/lib/paths";
import type {
  AiUseProposal,
  AiUseProposalVote,
  AiUseVote,
  CalibrationScore,
  Criterion,
  PledgeResponse,
  PledgeResponseVote,
  PledgeSlot,
  Room,
  RoomState,
  Scale,
  ScaleResponse,
  ScaleResponseVote,
  Vote,
} from "@/lib/types";
import { roundForState } from "@/lib/types";

function useCountdown(timerEnd: string | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!timerEnd) { setRemaining(null); return; }
    function tick() {
      const secs = Math.max(0, Math.round((new Date(timerEnd!).getTime() - Date.now()) / 1000));
      setRemaining(secs);
    }
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [timerEnd]);
  return remaining;
}

function fmt(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
import { StepShell } from "../_steps/shell";
import { StepFrame } from "../_steps/step-frame";
import { StepPropose } from "../_steps/step-propose";
import { StepVote } from "../_steps/step-vote";
import { StepScale } from "../_steps/step-scale";
import { StepScaleVote } from "../_steps/step-scale-vote";
import { StepCalibrate } from "../_steps/step-calibrate";
import { StepAiPropose } from "../_steps/step-ai-propose";
import { StepAiLadder } from "../_steps/step-ai-ladder";
import { StepAiVote } from "../_steps/step-ai-vote";
import { StepPledge } from "../_steps/step-pledge";
import { StepPledgeVote } from "../_steps/step-pledge-vote";
import { StepCommit } from "../_steps/step-commit";
import { JoinQR } from "@/app/_components/join-qr";
import { FacilitatorNudgeEditor } from "@/app/_components/nudge";

const STATE_ORDER: RoomState[] = [
  "lobby",
  "frame",
  "propose",
  "vote",
  "criteria_gate",
  "scale",
  "vote2",
  "ai_ladder_propose",
  "ai_ladder",
  "vote3",
  "pledge",
  "pledge_vote",
  "commit",
];

export function HostRoom({ code }: { code: string }) {
  const state = useRoom(code);

  if (state.status === "loading") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Wordmark />
        <div className="w-8 h-8 rounded-full border-2 border-[color:var(--color-cadet)]/20 border-t-[color:var(--color-cadet)] animate-spin" />
        <p className="text-[color:var(--color-cadet)]/70">spinning up the room…</p>
      </main>
    );
  }

  if (state.status === "error" && !state.snapshot) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <Wordmark />
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold mb-3">something wobbled.</h1>
          <p className="text-[color:var(--color-cadet)]/80">{state.error}</p>
        </div>
      </main>
    );
  }

  const snapshot = state.snapshot!;
  const {
    room,
    criteria,
    participants_count,
    votes,
    scales,
    scale_responses,
    scale_response_votes,
    calibration_scores,
    ai_use_votes,
    ai_use_proposals,
    ai_use_proposal_votes,
    pledge_slots,
    pledge_responses,
    pledge_response_votes,
  } = snapshot;

  const advance = useCallback(async (to: RoomState, fromState?: RoomState) => {
    await fetch(apiPath(`/api/rooms/${code}`), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: to, ...(fromState ? { from_state: fromState } : {}) }),
    });
  }, [code]);

  const startTimer = useCallback(async (durationSeconds: number) => {
    await fetch(apiPath(`/api/rooms/${code}/timer`), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ duration: durationSeconds }),
    });
  }, [code]);

  const cancelTimer = useCallback(async () => {
    await fetch(apiPath(`/api/rooms/${code}/timer`), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ duration: null }),
    });
  }, [code]);

  const tally = useCallback(async (round: 1 | 2 | 3) => {
    const endpoint =
      round === 1 ? "tally" : round === 2 ? "tally2" : "tally3";
    const res = await fetch(apiPath(`/api/rooms/${code}/${endpoint}`), { method: "POST" });
    if (!res.ok) throw new Error(`tally failed (${res.status})`);
  }, [code]);

  const aiTally = useCallback(async () => {
    const res = await fetch(apiPath(`/api/rooms/${code}/ai-tally`), { method: "POST" });
    if (!res.ok) throw new Error(`ai-tally failed (${res.status})`);
  }, [code]);

  const pledgeTally = useCallback(async () => {
    const res = await fetch(apiPath(`/api/rooms/${code}/tally-pledge`), { method: "POST" });
    if (!res.ok) throw new Error(`pledge tally failed (${res.status})`);
  }, [code]);

  const resolveChoice = useCallback(async (selectedIds: string[]) => {
    await fetch(apiPath(`/api/rooms/${code}/facilitator-choice`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selected_ids: selectedIds }),
    });
  }, [code]);

  const confirmGate = useCallback(async (selectedIds: string[]) => {
    await fetch(apiPath(`/api/rooms/${code}/facilitator-choice`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selected_ids: selectedIds }),
    });
    await fetch(apiPath(`/api/rooms/${code}`), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: "scale" }),
    });
  }, [code]);

  const surface: "white" | "champagne" =
    room.state === "lobby" || room.state === "frame" || room.state === "commit"
      ? "champagne"
      : "white";

  return (
    <StepShell
      state={room.state}
      role="host"
      participantsCount={participants_count}
      surface={surface}
    >
      <div className="space-y-8">
        <HostControls
          code={code}
          current={room.state}
          timerEnd={room.timer_end}
          timerDuration={room.timer_duration}
          onAdvance={advance}
          onTally={tally}
          onAiTally={aiTally}
          onPledgeTally={pledgeTally}
          onStartTimer={startTimer}
          onCancelTimer={cancelTimer}
        />

        <FacilitatorNudgeEditor code={code} currentNudge={room.facilitator_nudge} />

        <div className="pointer-events-none opacity-95">
          <HostBody
            code={code}
            room={room}
            criteria={criteria}
            votes={votes}
            scales={scales}
            scale_responses={scale_responses ?? []}
            scale_response_votes={scale_response_votes ?? []}
            calibration_scores={calibration_scores}
            ai_use_votes={ai_use_votes}
            ai_use_proposals={ai_use_proposals ?? []}
            ai_use_proposal_votes={ai_use_proposal_votes ?? []}
            pledge_slots={pledge_slots}
            pledge_responses={pledge_responses ?? []}
            pledge_response_votes={pledge_response_votes ?? []}
            participants_count={participants_count}
            onResolveChoice={resolveChoice}
            onConfirmGate={confirmGate}
          />
        </div>
      </div>
    </StepShell>
  );
}

const TIMER_OPTIONS = [
  { label: "3", seconds: 180 },
  { label: "5", seconds: 300 },
  { label: "10", seconds: 600 },
] as const;

function HostControls({
  code,
  current,
  timerEnd,
  timerDuration,
  onAdvance,
  onTally,
  onAiTally,
  onPledgeTally,
  onStartTimer,
  onCancelTimer,
}: {
  code: string;
  current: RoomState;
  timerEnd: string | null;
  timerDuration: number | null;
  onAdvance: (s: RoomState, fromState?: RoomState) => void;
  onTally: (round: 1 | 2 | 3) => Promise<void>;
  onAiTally: () => Promise<void>;
  onPledgeTally: () => Promise<void>;
  onStartTimer: (seconds: number) => Promise<void>;
  onCancelTimer: () => Promise<void>;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [tallyError, setTallyError] = useState<string | null>(null);
  const lastCurrent = useRef(current);
  const timerFiredFor = useRef<RoomState | null>(null);
  const remaining = useCountdown(timerEnd);

  useEffect(() => {
    if (lastCurrent.current !== current) {
      setPending(null);
      setTallyError(null);
      timerFiredFor.current = null;
      lastCurrent.current = current;
    }
  }, [current]);

  // auto-advance when timer reaches zero
  useEffect(() => {
    if (remaining === 0 && timerEnd && timerFiredFor.current !== current) {
      const i = STATE_ORDER.indexOf(current);
      const next = i >= 0 && i < STATE_ORDER.length - 1 ? STATE_ORDER[i + 1] : null;
      if (next) {
        timerFiredFor.current = current;
        onAdvance(next, current);
      }
    }
  }, [remaining, timerEnd, current, onAdvance]);

  const next = (() => {
    const i = STATE_ORDER.indexOf(current);
    return i >= 0 && i < STATE_ORDER.length - 1 ? STATE_ORDER[i + 1] : null;
  })();

  const isTallyState = current === "vote" || current === "vote2";
  const isGateState = current === "criteria_gate";
  const isAiTallyState = current === "ai_ladder_propose" || current === "ai_ladder" || current === "vote3";
  const isPledgeTallyState = current === "pledge_vote";
  const tallyRound = current === "vote" ? 1 : 2;

  async function wrap(action: () => Promise<void>, label: string) {
    setPending(label);
    setTallyError(null);
    try {
      await action();
    } catch (err) {
      setTallyError(err instanceof Error ? err.message : "something went wrong — check the console.");
    } finally {
      setTimeout(() => setPending((p) => (p === label ? null : p)), 3000);
    }
  }

  const tallyLabels: Record<1 | 2, { idle: string; busy: string }> = {
    1: { idle: "tally votes & review criteria", busy: "tallying…" },
    2: { idle: "lock descriptors & move to AI ladder", busy: "tallying…" },
  };

  const aiTallyLabel =
    current === "ai_ladder_propose"
      ? { idle: "close proposals & open vote", busy: "opening vote…" }
      : current === "vote3"
      ? { idle: "tally AI vote & move to pledge", busy: "tallying…" }
      : { idle: "lock ceiling & move to vote3", busy: "locking ceiling…" };

  const pledgeTallyLabel = { idle: "tally pledge & move to commit", busy: "tallying…" };

  const timerActive = timerEnd !== null && remaining !== null && remaining > 0;
  const isUrgent = remaining !== null && remaining <= 30 && remaining > 0;

  return (
    <div className="rounded-lg bg-[color:var(--color-cadet)] text-white p-4 pointer-events-auto space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs tracking-widest opacity-70">room code</p>
          <p className="text-2xl font-bold tracking-[0.3em]">{code}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {isTallyState ? (
            <button
              onClick={() => wrap(() => onTally(tallyRound as 1 | 2), "tally")}
              disabled={pending !== null}
              className="bg-[color:var(--color-sienna)] text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-wait"
            >
              {pending === "tally"
                ? tallyLabels[tallyRound as 1 | 2].busy
                : tallyLabels[tallyRound as 1 | 2].idle}
            </button>
          ) : isAiTallyState ? (
            <button
              onClick={() => wrap(onAiTally, "ai-tally")}
              disabled={pending !== null}
              className="bg-[color:var(--color-sienna)] text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-wait"
            >
              {pending === "ai-tally" ? aiTallyLabel.busy : aiTallyLabel.idle}
            </button>
          ) : isPledgeTallyState ? (
            <button
              onClick={() => wrap(onPledgeTally, "pledge-tally")}
              disabled={pending !== null}
              className="bg-[color:var(--color-sienna)] text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-wait"
            >
              {pending === "pledge-tally" ? pledgeTallyLabel.busy : pledgeTallyLabel.idle}
            </button>
          ) : isGateState ? null : next ? (
            <button
              onClick={async () => {
                setPending("advance");
                onAdvance(next);
                setTimeout(() => setPending((p) => (p === "advance" ? null : p)), 3000);
              }}
              disabled={pending !== null}
              className="bg-white text-[color:var(--color-cadet)] px-4 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-wait"
            >
              {pending === "advance" ? "moving…" : `move to ${next.replace(/_/g, " ")} →`}
            </button>
          ) : null}
          <div className="flex items-center gap-1 text-xs overflow-x-auto">
            {STATE_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => onAdvance(s)}
                className={`px-2 py-1 rounded shrink-0 ${
                  s === current
                    ? "bg-white text-[color:var(--color-cadet)]"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* timer controls */}
      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-white/20">
        <span className="text-xs tracking-widest opacity-70 shrink-0">timer</span>

        {timerActive ? (
          <>
            <span className={`font-mono text-2xl font-bold tabular-nums ${isUrgent ? "text-[color:var(--color-sienna)]" : "text-white"}`}>
              {fmt(remaining!)}
            </span>
            <span className="text-xs opacity-60">auto-advancing on zero</span>
            <button
              onClick={() => wrap(onCancelTimer, "cancel-timer")}
              disabled={pending !== null}
              className="ml-auto text-xs px-3 py-1.5 rounded border border-white/40 hover:bg-white/10 disabled:opacity-50"
            >
              cancel timer
            </button>
          </>
        ) : (
          <>
            <span className="text-xs opacity-60">set:</span>
            {TIMER_OPTIONS.map(({ label, seconds }) => (
              <button
                key={seconds}
                onClick={() => wrap(() => onStartTimer(seconds), `timer-${seconds}`)}
                disabled={pending !== null}
                className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors disabled:opacity-50 ${
                  timerDuration === seconds && remaining === 0
                    ? "bg-white text-[color:var(--color-cadet)] border-white"
                    : "border-white/40 hover:bg-white/10"
                }`}
              >
                {label} min
              </button>
            ))}
          </>
        )}
      </div>

      {tallyError ? (
        <p className="text-xs text-[color:var(--color-sienna)] bg-black/20 rounded px-3 py-2">
          {tallyError}
        </p>
      ) : null}
    </div>
  );
}

type HostBodyProps = {
  code: string;
  room: Room;
  criteria: Criterion[];
  votes: Vote[];
  scales: Scale[];
  scale_responses: ScaleResponse[];
  scale_response_votes: ScaleResponseVote[];
  calibration_scores: CalibrationScore[];
  ai_use_votes: AiUseVote[];
  ai_use_proposals: AiUseProposal[];
  ai_use_proposal_votes: AiUseProposalVote[];
  pledge_slots: PledgeSlot[];
  pledge_responses: PledgeResponse[];
  pledge_response_votes: PledgeResponseVote[];
  participants_count: number;
  onResolveChoice: (selectedIds: string[]) => void;
  onConfirmGate: (selectedIds: string[]) => void;
};

function HostBody({
  code,
  room,
  criteria,
  votes,
  scales,
  scale_responses,
  scale_response_votes,
  calibration_scores,
  ai_use_votes,
  ai_use_proposals,
  ai_use_proposal_votes,
  pledge_slots,
  pledge_responses,
  pledge_response_votes,
  participants_count,
  onResolveChoice,
  onConfirmGate,
}: HostBodyProps) {
  const voteRound = roundForState(room.state);

  switch (room.state) {
    case "lobby":
      return (
        <Collapsible label="lobby — join link" defaultOpen>
          <div className="flex flex-col items-center text-center gap-5 py-10">
            <h2 className="text-2xl font-bold">share the join link.</h2>
            <p className="text-[color:var(--color-cadet)]/80 max-w-md">
              students scan the code below, or visit{" "}
              <span className="font-mono text-sm">/room/{room.code}/join</span> directly.
            </p>
            <JoinQR code={room.code} size={200} />
            <p className="text-sm text-[color:var(--color-cadet)]/70">
              {participants_count} in the room so far.
            </p>
          </div>
        </Collapsible>
      );
    case "frame":
      return (
        <Collapsible label="frame — learning outcome + artifact">
          <StepFrame room={room} />
        </Collapsible>
      );
    case "propose":
      return (
        <Collapsible label={`proposals — ${criteria.length} criteri${criteria.length === 1 ? "on" : "a"}`} autoExpand={criteria.length}>
          <StepPropose code={code} criteria={criteria} canEdit={false} />
        </Collapsible>
      );
    case "criteria_gate":
      return (
        <Collapsible label="facilitator review — select criteria for scaling" defaultOpen>
          <CriteriaGatePanel
            criteria={criteria}
            votes={votes}
            onConfirm={onConfirmGate}
          />
        </Collapsible>
      );
    case "vote":
      return (
        <Collapsible
          label={`vote round 1 — ${votes.filter((v) => (v.round ?? 1) === 1).length} dots cast`}
          autoExpand={votes.filter((v) => (v.round ?? 1) === 1).length}
        >
          <>
            <StepVote
              code={code}
              criteria={criteria.filter((c) => c.status !== "rejected")}
              votes={votes}
              participantId={null}
              participantsCount={participants_count}
              round={1}
            />
            <TiebreakerPanel
              criteria={criteria}
              votes={votes}
              round={1}
              onResolve={onResolveChoice}
            />
          </>
        </Collapsible>
      );
    case "vote3":
      return (
        <Collapsible
          label={`AI use vote — ${ai_use_votes.length} votes cast`}
          autoExpand={ai_use_votes.length}
        >
          <StepAiVote
            code={code}
            aiUseVotes={ai_use_votes}
            participantId={null}
            participantsCount={participants_count}
          />
        </Collapsible>
      );
    case "vote2":
      return (
        <Collapsible
          label={`vote round 2 — ${scale_response_votes.length} dots across descriptors`}
          autoExpand={scale_response_votes.length}
        >
          <StepScaleVote
            code={code}
            criteria={criteria}
            scaleResponses={scale_responses}
            scaleResponseVotes={scale_response_votes}
            participantId={null}
            participantsCount={participants_count}
          />
        </Collapsible>
      );
    case "scale":
      return (
        <Collapsible
          label={`scale — ${scale_responses.length} student response${scale_responses.length === 1 ? "" : "s"}`}
          autoExpand={scale_responses.length}
        >
          <StepScale
            code={code}
            criteria={criteria}
            scales={scales}
            scaleResponses={scale_responses}
            participantId={null}
            canEdit={false}
          />
        </Collapsible>
      );
    case "calibrate":
      return (
        <Collapsible label="calibrate (legacy)">
          <StepCalibrate
            code={code}
            room={room}
            criteria={criteria}
            scales={scales}
            scores={calibration_scores}
            participantId={null}
          />
        </Collapsible>
      );
    case "ai_ladder_propose":
      return (
        <Collapsible
          label={`AI ladder · propose — ${ai_use_proposals.length} proposal${
            ai_use_proposals.length === 1 ? "" : "s"
          }`}
          autoExpand={ai_use_proposals.length}
        >
          <StepAiPropose
            code={code}
            proposals={ai_use_proposals}
            participantId={null}
            participantsCount={participants_count}
          />
        </Collapsible>
      );
    case "ai_ladder":
      return (
        <Collapsible
          label={`AI ladder · vote — ${ai_use_proposal_votes.length} dot${
            ai_use_proposal_votes.length === 1 ? "" : "s"
          }`}
          autoExpand={ai_use_proposal_votes.length}
        >
          <StepAiLadder
            code={code}
            proposals={ai_use_proposals}
            proposalVotes={ai_use_proposal_votes}
            legacyVotes={ai_use_votes}
            participantId={null}
            participantsCount={participants_count}
          />
        </Collapsible>
      );
    case "pledge":
      return (
        <Collapsible
          label={`pledge — ${pledge_responses.length} response${pledge_responses.length === 1 ? "" : "s"}`}
          autoExpand={pledge_responses.length}
        >
          <StepPledge
            code={code}
            slots={pledge_slots}
            votes={ai_use_votes}
            proposals={ai_use_proposals}
            proposalVotes={ai_use_proposal_votes}
            participantId={null}
            pledgeResponses={pledge_responses}
            participantsCount={participants_count}
          />
        </Collapsible>
      );
    case "pledge_vote":
      return (
        <Collapsible
          label={`pledge vote — ${pledge_response_votes.length} dot${pledge_response_votes.length === 1 ? "" : "s"}`}
          autoExpand={pledge_response_votes.length}
        >
          <StepPledgeVote
            code={code}
            pledgeResponses={pledge_responses}
            pledgeResponseVotes={pledge_response_votes}
            participantId={null}
            participantsCount={participants_count}
          />
        </Collapsible>
      );
    case "commit":
      return (
        <Collapsible label="commit — final rubric">
          <StepCommit
            room={room}
            criteria={criteria}
            scales={scales}
            votes={ai_use_votes}
            proposals={ai_use_proposals}
            proposalVotes={ai_use_proposal_votes}
            slots={pledge_slots}
          />
        </Collapsible>
      );
  }
}

// ---------- Collapsible wrapper ----------

function Collapsible({
  label,
  children,
  defaultOpen = false,
  autoExpand,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  autoExpand?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const prev = useRef(autoExpand ?? 0);

  // auto-expand when content count increases (fan-out pattern)
  useEffect(() => {
    if (
      typeof autoExpand === "number" &&
      autoExpand > 0 &&
      autoExpand !== prev.current
    ) {
      setOpen(true);
      prev.current = autoExpand;
    }
  }, [autoExpand]);

  return (
    <div className="rounded-lg border border-[color:var(--color-cadet)]/15 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 bg-[color:var(--color-champagne)]/40 hover:bg-[color:var(--color-champagne)]/70 transition-colors text-left pointer-events-auto"
      >
        <span className="text-sm font-medium text-[color:var(--color-cadet)]">{label}</span>
        <span aria-hidden="true" className="text-[color:var(--color-cadet)]/50 text-xs ml-4">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="p-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

// ---------- Tiebreaker panel ----------

function TiebreakerPanel({
  criteria,
  votes,
  round,
  onResolve,
}: {
  criteria: Criterion[];
  votes: Vote[];
  round: 1 | 2 | 3;
  onResolve: (selectedIds: string[]) => void;
}) {
  const [resolving, setResolving] = useState(false);
  const [picks, setPicks] = useState<Set<string>>(new Set());

  const roundVotes = votes.filter((v) => (v.round ?? 1) === round);
  const counts = new Map<string, number>();
  for (const v of roundVotes) counts.set(v.criterion_id, (counts.get(v.criterion_id) ?? 0) + 1);

  // find tied groups: criteria with the same vote count > 0
  const countValues = [...new Set(counts.values())].sort((a, b) => b - a);
  const tiedCriteria: Criterion[] = [];
  for (const count of countValues) {
    const group = criteria.filter((c) => (counts.get(c.id) ?? 0) === count);
    if (group.length > 1 && count > 0) {
      tiedCriteria.push(...group);
    }
  }

  if (tiedCriteria.length === 0) return null;

  async function resolve() {
    setResolving(true);
    await onResolve([...picks]);
    setResolving(false);
    setPicks(new Set());
  }

  return (
    <div className="mt-6 rounded-lg border-2 border-[color:var(--color-sienna)]/40 bg-[color:var(--color-sienna)]/5 p-4 space-y-3 pointer-events-auto">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-[color:var(--color-sienna)] text-lg">⚖</span>
        <h3 className="font-semibold text-[color:var(--color-cadet)]">facilitator decides</h3>
      </div>
      <p className="text-sm text-[color:var(--color-cadet)]/80">
        these criteria are tied. tick the ones to keep — unticked ones will be set to rejected.
      </p>
      <div className="space-y-2">
        {tiedCriteria.map((c) => (
          <label key={c.id} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={picks.has(c.id)}
              onChange={(e) =>
                setPicks((p) => {
                  const next = new Set(p);
                  e.target.checked ? next.add(c.id) : next.delete(c.id);
                  return next;
                })
              }
              className="h-4 w-4 accent-[color:var(--color-sienna)]"
            />
            <span className="text-sm font-medium">{c.name}</span>
            <span className="text-xs text-[color:var(--color-cadet)]/60">
              {counts.get(c.id) ?? 0} vote{counts.get(c.id) === 1 ? "" : "s"}
            </span>
          </label>
        ))}
      </div>
      <button
        onClick={resolve}
        disabled={picks.size === 0 || resolving}
        className="text-sm px-4 py-2 rounded bg-[color:var(--color-sienna)] text-white disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90"
      >
        {resolving ? "applying…" : `keep ${picks.size} selected`}
      </button>
    </div>
  );
}

// ---------- Criteria Gate panel ----------

function CriteriaGatePanel({
  criteria,
  votes,
  onConfirm,
}: {
  criteria: Criterion[];
  votes: Vote[];
  onConfirm: (selectedIds: string[]) => void;
}) {
  const round1Votes = votes.filter((v) => (v.round ?? 1) === 1);
  const counts = new Map<string, number>();
  for (const v of round1Votes) counts.set(v.criterion_id, (counts.get(v.criterion_id) ?? 0) + 1);

  const votedCriteria = criteria.filter((c) => !c.required);

  const [picks, setPicks] = useState<Set<string>>(
    () => new Set(criteria.filter((c) => c.status === "selected" && !c.required).map((c) => c.id)),
  );
  const [confirming, setConfirming] = useState(false);

  const requiredCriteria = criteria.filter((c) => c.required);

  async function confirm() {
    setConfirming(true);
    const allSelected = [
      ...requiredCriteria.map((c) => c.id),
      ...[...picks],
    ];
    await onConfirm(allSelected);
    setConfirming(false);
  }

  const totalSelected = requiredCriteria.length + picks.size;

  return (
    <div className="space-y-4 pointer-events-auto">
      <p className="text-sm text-[color:var(--color-cadet)]/80">
        round 1 voting is complete. tick the criteria that should move to the scaling step.
        required criteria always proceed.
      </p>

      {requiredCriteria.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-widest text-[color:var(--color-cadet)]/50 uppercase">required (always included)</p>
          {requiredCriteria.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded bg-[color:var(--color-cadet)]/5">
              <input type="checkbox" checked disabled className="h-4 w-4 opacity-50" />
              <span className="text-sm font-medium">{c.name}</span>
              <span className="text-xs text-[color:var(--color-cadet)]/50 ml-auto">
                {counts.get(c.id) ?? 0} vote{(counts.get(c.id) ?? 0) === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      )}

      {votedCriteria.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-widest text-[color:var(--color-cadet)]/50 uppercase">
            proposed — {picks.size} of {votedCriteria.length} selected
          </p>
          {votedCriteria
            .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
            .map((c) => (
              <label
                key={c.id}
                className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                  picks.has(c.id)
                    ? "bg-[color:var(--color-cadet)]/8"
                    : "bg-transparent opacity-60 hover:opacity-80"
                }`}
              >
                <input
                  type="checkbox"
                  checked={picks.has(c.id)}
                  onChange={(e) =>
                    setPicks((p) => {
                      const next = new Set(p);
                      e.target.checked ? next.add(c.id) : next.delete(c.id);
                      return next;
                    })
                  }
                  className="h-4 w-4 accent-[color:var(--color-cadet)]"
                />
                <span className="text-sm font-medium flex-1">{c.name}</span>
                <span className="text-xs text-[color:var(--color-cadet)]/60 tabular-nums">
                  {counts.get(c.id) ?? 0} vote{(counts.get(c.id) ?? 0) === 1 ? "" : "s"}
                </span>
              </label>
            ))}
        </div>
      )}

      <button
        onClick={confirm}
        disabled={totalSelected === 0 || confirming}
        className="w-full text-sm px-4 py-2.5 rounded bg-[color:var(--color-cadet)] text-white font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {confirming ? "confirming…" : `confirm ${totalSelected} criteri${totalSelected === 1 ? "on" : "a"} & move to scale`}
      </button>
    </div>
  );
}
