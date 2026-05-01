"use client";

import { useEffect, useState } from "react";
import { useRoom } from "@/lib/use-room";
import { ensureJoined } from "@/lib/participant";
import { StepShell } from "./_steps/shell";
import { StepFrame } from "./_steps/step-frame";
import { StepPropose } from "./_steps/step-propose";
import { StepVote } from "./_steps/step-vote";
import { StepScale } from "./_steps/step-scale";
import { StepScaleVote } from "./_steps/step-scale-vote";
import { StepCalibrate } from "./_steps/step-calibrate";
import { StepAiPropose } from "./_steps/step-ai-propose";
import { StepAiLadder } from "./_steps/step-ai-ladder";
import { StepAiVote } from "./_steps/step-ai-vote";
import { StepPledge } from "./_steps/step-pledge";
import { StepPledgeVote } from "./_steps/step-pledge-vote";
import { StepCommit } from "./_steps/step-commit";
import { GuidingQuestions } from "./_steps/guiding-questions";
import { Wordmark } from "@/app/_components/wordmark";
import { FacilitatorNudgeBanner } from "@/app/_components/nudge";
import type { RoomState } from "@/lib/types";

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

function TimerBanner({ timerEnd, currentState }: {
  timerEnd: string | null;
  currentState: RoomState;
}) {
  const remaining = useCountdown(timerEnd);

  if (!timerEnd || remaining === null) return null;

  const isUrgent = remaining <= 30 && remaining > 0;
  const isDone = remaining === 0;

  return (
    <div className={`flex items-center justify-center gap-3 rounded-lg px-4 py-3 mb-4 ${
      isDone
        ? "bg-[color:var(--color-sienna)]/20 border border-[color:var(--color-sienna)]/40"
        : isUrgent
        ? "bg-[color:var(--color-sienna)]/10 border border-[color:var(--color-sienna)]/30"
        : "bg-[color:var(--color-cadet)]/8 border border-[color:var(--color-cadet)]/15"
    }`}>
      <span className="text-xs tracking-widest opacity-60 uppercase">time left</span>
      <span className={`font-mono text-4xl font-bold tabular-nums leading-none ${
        isDone ? "text-[color:var(--color-sienna)]" : isUrgent ? "text-[color:var(--color-sienna)]" : "text-[color:var(--color-cadet)]"
      }`}>
        {isDone ? "moving…" : fmt(remaining)}
      </span>
    </div>
  );
}

export function StudentRoom({ code }: { code: string }) {
  const state = useRoom(code);
  const [participantId, setParticipantId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureJoined(code).then((id) => {
      if (!cancelled) setParticipantId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (state.status === "loading") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Wordmark />
        <div className="w-8 h-8 rounded-full border-2 border-[color:var(--color-cadet)]/20 border-t-[color:var(--color-cadet)] animate-spin" />
        <p className="text-[color:var(--color-cadet)]/70">joining room…</p>
      </main>
    );
  }

  if (state.status === "error" && !state.snapshot) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <Wordmark />
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold mb-3">no room at that code.</h1>
          <p className="text-[color:var(--color-cadet)]/80">
            double-check with whoever set it up.
          </p>
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

  const canEdit = participantId !== null;
  const nudge = <FacilitatorNudgeBanner text={room.facilitator_nudge} />;
  const guide = <GuidingQuestions state={room.state as RoomState} />;
  const timer = <TimerBanner timerEnd={room.timer_end} currentState={room.state as RoomState} />;

  const body = (() => {
    if (room.state === "lobby") {
      return (
        <div className="flex flex-col items-center justify-center text-center gap-4 min-h-[50vh]">
          <h1 className="text-3xl sm:text-4xl font-bold">you&apos;re in.</h1>
          <p className="text-[color:var(--color-cadet)]/80 max-w-md">
            the host is still getting the room ready. it&apos;ll move on in a moment.
          </p>
          <p className="text-xs tracking-widest text-[color:var(--color-cadet)]/50 mt-4">
            room · {room.code}
          </p>
        </div>
      );
    }
    if (room.state === "frame") return <StepFrame room={room} />;
    if (room.state === "criteria_gate") {
      return (
        <div className="flex flex-col items-center justify-center text-center gap-4 min-h-[50vh]">
          <h1 className="text-2xl font-bold">votes are in.</h1>
          <p className="text-[color:var(--color-cadet)]/80 max-w-md">
            the facilitator is reviewing the results and selecting which criteria move to scaling.
            hang tight — it&apos;ll move on in a moment.
          </p>
          <p className="text-xs tracking-widest text-[color:var(--color-cadet)]/50 mt-4">
            room · {room.code}
          </p>
        </div>
      );
    }
    if (room.state === "propose") {
      return <StepPropose code={code} criteria={criteria} canEdit={canEdit} />;
    }
    if (room.state === "vote") {
      const ballot = criteria.filter((c) => c.status !== "rejected");
      return (
        <StepVote
          code={code}
          criteria={ballot}
          votes={votes}
          participantId={participantId}
          participantsCount={participants_count}
          round={1}
        />
      );
    }
    if (room.state === "vote3") {
      return (
        <StepAiVote
          code={code}
          aiUseVotes={ai_use_votes ?? []}
          participantId={participantId}
          participantsCount={participants_count}
        />
      );
    }
    if (room.state === "vote2") {
      return (
        <StepScaleVote
          code={code}
          criteria={criteria}
          scaleResponses={scale_responses ?? []}
          scaleResponseVotes={scale_response_votes ?? []}
          participantId={participantId}
          participantsCount={participants_count}
        />
      );
    }
    if (room.state === "scale") {
      return (
        <StepScale
          code={code}
          criteria={criteria}
          scales={scales}
          scaleResponses={scale_responses ?? []}
          participantId={participantId}
          canEdit={canEdit}
        />
      );
    }
    if (room.state === "calibrate") {
      // legacy state: rooms created before the rework land here
      return (
        <StepCalibrate
          code={code}
          room={room}
          criteria={criteria}
          scales={scales}
          scores={calibration_scores}
          participantId={participantId}
        />
      );
    }
    if (room.state === "ai_ladder_propose") {
      return (
        <StepAiPropose
          code={code}
          proposals={ai_use_proposals ?? []}
          participantId={participantId}
          participantsCount={participants_count}
        />
      );
    }
    if (room.state === "ai_ladder") {
      return (
        <StepAiLadder
          code={code}
          proposals={ai_use_proposals ?? []}
          proposalVotes={ai_use_proposal_votes ?? []}
          legacyVotes={ai_use_votes}
          participantId={participantId}
          participantsCount={participants_count}
        />
      );
    }
    if (room.state === "pledge") {
      return (
        <StepPledge
          code={code}
          slots={pledge_slots}
          votes={ai_use_votes}
          proposals={ai_use_proposals ?? []}
          proposalVotes={ai_use_proposal_votes ?? []}
          participantId={participantId}
          pledgeResponses={pledge_responses ?? []}
          participantsCount={participants_count}
        />
      );
    }
    if (room.state === "pledge_vote") {
      return (
        <StepPledgeVote
          code={code}
          pledgeResponses={pledge_responses ?? []}
          pledgeResponseVotes={pledge_response_votes ?? []}
          participantId={participantId}
          participantsCount={participants_count}
        />
      );
    }
    return (
      <StepCommit
        room={room}
        criteria={criteria}
        scales={scales}
        votes={ai_use_votes}
        proposals={ai_use_proposals ?? []}
        proposalVotes={ai_use_proposal_votes ?? []}
        slots={pledge_slots}
      />
    );
  })();

  const surface =
    room.state === "lobby" ||
    room.state === "frame" ||
    room.state === "commit"
      ? "champagne"
      : undefined;

  return (
    <StepShell
      state={room.state as RoomState}
      role="student"
      participantsCount={participants_count}
      surface={surface}
    >
      {timer}
      {nudge}
      {guide}
      {body}
    </StepShell>
  );
}
