"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useParty } from "@/lib/use-party";
import { FacilitatorDashboard } from "@/components/facilitator-dashboard";
import type { Activity, AgeLevel } from "@/lib/types";

export default function FacilitatorLivePage() {
  const { code } = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const [initialized, setInitialized] = useState(false);
  const { state, connected, send } = useParty({
    roomCode: code,
    role: "facilitator",
  });

  // on first connect, load session config from sessionStorage and push to room
  useEffect(() => {
    if (!connected || initialized || !state) return;

    const stored = sessionStorage.getItem(`raft:${code}`);
    if (stored && state.activities.length === 0) {
      const config = JSON.parse(stored) as { activities: Activity[]; displayMode?: "shared-screen" | "screenless"; ageLevel?: AgeLevel };
      send({
        type: "setup" as const,
        activities: config.activities,
        displayMode: config.displayMode,
        ageLevel: config.ageLevel,
      });
    }
    setInitialized(true);
  }, [connected, initialized, state, code, send]);

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">connecting...</p>
          <p className="text-sm text-[var(--rh-text-muted)]">
            room {code}
          </p>
        </div>
      </div>
    );
  }

  return <FacilitatorDashboard state={state} send={send} connected={connected} />;
}
