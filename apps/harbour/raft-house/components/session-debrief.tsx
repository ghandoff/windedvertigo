"use client";

import { useRef } from "react";
import Link from "next/link";
import type {
  RoomState,
  Activity,
  Phase,
  Participant,
  PollConfig,
  PredictionConfig,
  PuzzleConfig,
  SortingConfig,
} from "@/lib/types";

// ── phase arc ────────────────────────────────────────────────────

const PHASES: Phase[] = [
  "encounter",
  "struggle",
  "threshold",
  "integration",
  "application",
];

const PHASE_LABELS: Record<Phase, string> = {
  encounter: "encounter",
  struggle: "struggle",
  threshold: "threshold",
  integration: "integration",
  application: "application",
};

// ── activity summary extraction ──────────────────────────────────

interface ActivitySummary {
  label: string;
  phase: Phase;
  type: string;
  insight: string;
}

function getParticipantResponses(
  activity: Activity,
  participants: Record<string, Participant>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [id, p] of Object.entries(participants)) {
    if (p.responses[activity.id] !== undefined) {
      out[id] = p.responses[activity.id];
    }
  }
  return out;
}

function summarizeActivity(
  activity: Activity,
  participants: Record<string, Participant>,
): ActivitySummary {
  const responses = getParticipantResponses(activity, participants);
  const count = Object.keys(responses).length;
  const base = { label: activity.label, phase: activity.phase, type: activity.type };

  if (count === 0) return { ...base, insight: "no responses" };

  switch (activity.config.type) {
    case "poll": {
      const cfg = activity.config.poll as PollConfig;
      const tally: Record<string, number> = {};
      for (const opt of cfg.options) tally[opt.id] = 0;
      for (const r of Object.values(responses)) {
        const votes = Array.isArray(r) ? r : [r];
        for (const v of votes) {
          const key = String(v);
          if (tally[key] !== undefined) tally[key]++;
        }
      }
      const sorted = Object.entries(tally).sort(([, a], [, b]) => b - a);
      const winner = cfg.options.find((o) => o.id === sorted[0]?.[0]);
      const topCount = sorted[0]?.[1] ?? 0;
      const unanimous = topCount === count;
      return {
        ...base,
        insight: unanimous
          ? `unanimous: ${winner?.label}`
          : `${winner?.label} led with ${topCount}/${count} votes`,
      };
    }
    case "prediction": {
      const cfg = activity.config.prediction as PredictionConfig;
      if (cfg.type === "number" && cfg.answer !== undefined) {
        const nums = Object.values(responses).filter((r): r is number => typeof r === "number");
        if (nums.length > 0) {
          const closest = nums.reduce((a, b) =>
            Math.abs(a - Number(cfg.answer)) <= Math.abs(b - Number(cfg.answer)) ? a : b,
          );
          return { ...base, insight: `closest guess: ${closest} (answer: ${cfg.answer})` };
        }
      }
      return { ...base, insight: `${count} predictions submitted` };
    }
    case "puzzle": {
      const cfg = activity.config.puzzle as PuzzleConfig;
      let perfectCount = 0;
      for (const r of Object.values(responses)) {
        const seq = r as string[];
        if (seq.length === cfg.solution.length && seq.every((v, i) => v === cfg.solution[i])) {
          perfectCount++;
        }
      }
      return {
        ...base,
        insight: perfectCount === count
          ? `all ${count} got it right`
          : `${perfectCount}/${count} solved perfectly`,
      };
    }
    case "sorting": {
      const cfg = activity.config.sorting as SortingConfig;
      if (cfg.solution) {
        const scores = Object.values(responses).map((r) => {
          const mapping = r as Record<string, string>;
          let correct = 0;
          for (const [cardId, catId] of Object.entries(mapping)) {
            if (cfg.solution![cardId] === catId) correct++;
          }
          return correct;
        });
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return {
          ...base,
          insight: `average: ${avg.toFixed(1)}/${cfg.cards.length} correct`,
        };
      }
      return { ...base, insight: `${count} sortings submitted` };
    }
    case "canvas": {
      const pins = Object.values(responses).flatMap((r) =>
        Array.isArray(r)
          ? (r as { x: number; y: number }[])
          : [r as { x: number; y: number }],
      );
      if (pins.length < 2) return { ...base, insight: `${pins.length} pins placed` };
      const avgX = pins.reduce((s, p) => s + p.x, 0) / pins.length;
      const avgY = pins.reduce((s, p) => s + p.y, 0) / pins.length;
      const cfg = activity.config.canvas;
      const spread = Math.sqrt(
        pins.reduce((s, p) => s + (p.x - avgX) ** 2 + (p.y - avgY) ** 2, 0) / pins.length,
      );
      const maxSpread = Math.sqrt(cfg.width ** 2 + cfg.height ** 2) / 2;
      const consensus = 1 - Math.min(spread / maxSpread, 1);
      const desc = consensus > 0.6 ? "strong consensus" : consensus > 0.35 ? "moderate spread" : "wide disagreement";
      return { ...base, insight: `${count} pins — ${desc}` };
    }
    case "reflection":
    case "open-response": {
      return { ...base, insight: `${count} responses shared` };
    }
    case "asymmetric": {
      const roles = activity.config.asymmetric.roles;
      return { ...base, insight: `${count} perspectives across ${roles.length} roles` };
    }
    case "rule-sandbox": {
      return { ...base, insight: `${count} experiments submitted` };
    }
    default:
      return { ...base, insight: `${count} responses` };
  }
}

// ── reflection prompt generation ─────────────────────────────────

function generateReflection(summaries: ActivitySummary[]): string {
  // find notable moments
  const unanimous = summaries.find((s) => s.insight.startsWith("unanimous"));
  const disagreement = summaries.find((s) => s.insight.includes("wide disagreement"));
  const perfect = summaries.find((s) => s.insight.includes("all ") && s.insight.includes("got it right"));

  if (unanimous && disagreement) {
    return `your group was unanimous on "${unanimous.label}" but split wide on "${disagreement.label}" — what made one feel obvious and the other uncertain?`;
  }
  if (unanimous) {
    return `your group was unanimous on "${unanimous.label}" — was this truly consensus or groupthink? what would someone outside the group say?`;
  }
  if (disagreement) {
    return `"${disagreement.label}" revealed wide disagreement — what assumptions might be driving the different positions?`;
  }
  if (perfect) {
    return `everyone nailed "${perfect.label}" — what shared knowledge made this possible? where might that confidence be misplaced?`;
  }
  if (summaries.length >= 3) {
    return `you moved through ${summaries.length} activities — which one shifted your thinking the most? which felt unresolved?`;
  }
  return "what surprised you most? what question are you leaving with that you didn't arrive with?";
}

// ── component ────────────────────────────────────────────────────

interface SessionDebriefProps {
  state: RoomState;
  saveStatus: "idle" | "saving" | "saved" | "error";
  onExport: () => void;
}

export function SessionDebrief({ state, saveStatus, onExport }: SessionDebriefProps) {
  const debriefRef = useRef<HTMLDivElement>(null);
  const participants = Object.values(state.participants);
  const summaries = state.activities.map((a) => summarizeActivity(a, state.participants));
  const reflection = generateReflection(summaries);

  // which phases were covered
  const coveredPhases = new Set(state.activities.map((a) => a.phase));

  return (
    <div ref={debriefRef} data-debrief className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      {/* header */}
      <div className="text-center mb-10">
        <p className="text-4xl mb-4">🛶</p>
        <h1 className="text-2xl font-bold tracking-tight mb-2">session debrief</h1>
        <p className="text-sm text-[var(--rh-text-muted)]">
          {participants.length} participants · {state.activities.length} activities · code {state.code}
        </p>
        <p className="text-xs text-[var(--rh-text-muted)] mt-2">
          {saveStatus === "saving" && "saving to history..."}
          {saveStatus === "saved" && "✓ saved to session history"}
          {saveStatus === "error" && "could not save — export results below"}
        </p>
      </div>

      {/* phase arc */}
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rh-text-muted)] mb-3">
          learning arc
        </p>
        <div className="flex items-center gap-1">
          {PHASES.map((phase, i) => {
            const covered = coveredPhases.has(phase);
            const actCount = state.activities.filter((a) => a.phase === phase).length;
            return (
              <div key={phase} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className={`w-full h-2 rounded-full transition-colors ${
                    covered ? "bg-[var(--rh-teal)]" : "bg-black/5"
                  }`}
                />
                <span className={`text-[10px] tracking-wider ${
                  covered ? "text-[var(--rh-teal)] font-medium" : "text-[var(--rh-text-muted)]"
                }`}>
                  {PHASE_LABELS[phase]}
                </span>
                {covered && (
                  <span className="text-[9px] text-[var(--rh-text-muted)]">
                    {actCount} {actCount === 1 ? "activity" : "activities"}
                  </span>
                )}
                {i < PHASES.length - 1 && <span />}
              </div>
            );
          })}
        </div>
      </div>

      {/* activity summaries */}
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rh-text-muted)] mb-3">
          activity highlights
        </p>
        <div className="space-y-2">
          {summaries.map((s, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-xl bg-white border border-black/5"
            >
              <span className="w-6 h-6 rounded-full bg-[var(--rh-teal)] text-white text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium truncate">{s.label}</span>
                  <span className="text-[9px] bg-[var(--rh-foam)]/20 text-[var(--rh-teal)] px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {s.phase}
                  </span>
                </div>
                <p className="text-xs text-[var(--rh-text-muted)]">{s.insight}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* reflection prompt */}
      <div className="mb-10 p-5 rounded-2xl bg-[var(--rh-sand)] border border-black/5">
        <p className="text-xs uppercase tracking-wider text-[var(--rh-text-muted)] mb-2">
          closing reflection
        </p>
        <p className="text-sm font-medium leading-relaxed">{reflection}</p>
      </div>

      {/* actions */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onExport}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-black/10 text-sm font-medium hover:bg-black/5 transition-colors"
        >
          export as image
        </button>
        <Link
          href="/facilitate/history"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-black/10 text-sm font-medium hover:bg-black/5 transition-colors"
        >
          view session history
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--rh-teal)] text-white text-sm font-semibold hover:bg-[var(--rh-deep)] transition-colors"
        >
          back to raft.house
        </Link>
      </div>
    </div>
  );
}
