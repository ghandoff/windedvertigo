"use client";

import { Wordmark } from "@/app/_components/wordmark";
import type { RoomState } from "@/lib/types";

const STATE_LABELS: Record<RoomState, string> = {
  lobby: "0.5 arrivals",
  frame: "1 frame",
  propose: "2 propose",
  vote: "3 vote — round 1",
  criteria_gate: "3.5 facilitator review",
  scale: "4 scale",
  vote2: "5 vote — scale descriptors",
  vote3: "7.5 vote — AI use rung",
  calibrate: "5.6 calibrate",        // legacy
  ai_ladder_propose: "6 AI ladder — propose",
  ai_ladder: "7 AI ladder — vote",
  pledge: "8 pledge",
  pledge_vote: "8.5 vote — pledge wording",
  commit: "9 commit",
};

export function StepShell({
  children,
  state,
  surface = "white",
  participantsCount,
  role,
}: {
  children: React.ReactNode;
  state: RoomState;
  surface?: "white" | "champagne";
  participantsCount?: number;
  role: "host" | "student";
}) {
  const bg = surface === "champagne" ? "surface-champagne" : "";
  return (
    <main className={`min-h-screen w-full px-6 py-10 ${bg}`}>
      <Wordmark />
      <header className="max-w-6xl mx-auto mb-8 flex items-center justify-between gap-4">
        <p className="text-xs tracking-widest text-[color:var(--color-cadet)]/70">
          {role} view · step {STATE_LABELS[state] ?? state}
        </p>
        {typeof participantsCount === "number" ? (
          <p className="text-xs text-[color:var(--color-cadet)]/70">
            {participantsCount} joined
          </p>
        ) : null}
      </header>
      <div className="max-w-6xl mx-auto">{children}</div>
    </main>
  );
}
