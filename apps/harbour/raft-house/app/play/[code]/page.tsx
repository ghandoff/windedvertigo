"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useParty } from "@/lib/use-party";
import { ActivityRenderer } from "@/components/activity-renderer";
import { AgeLevelProvider } from "@/lib/age-context";
import { TimerDisplay } from "@/components/timer-display";
import { useCallback, useEffect, useState } from "react";
import type { Notification } from "@/lib/use-party";

export default function PlayPage() {
  const { code } = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const displayName = searchParams.get("name") || "anonymous";
  const participantRole = searchParams.get("role") || "participant";

  const { state, connected, send, notifications, dismissNotification, myId } =
    useParty({
      roomCode: code,
      role: "participant",
      name: displayName,
      participantRole,
    });

  // track locally submitted activities for immediate UI feedback
  const [localSubmitted, setLocalSubmitted] = useState<Set<string>>(new Set());

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-4xl mb-4">🛶</p>
          <p className="text-lg font-semibold mb-2">joining room...</p>
          <p className="text-sm text-[var(--rh-text-muted)] font-mono">
            {code}
          </p>
        </div>
      </div>
    );
  }

  if (state.status === "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">🛶</p>
          <h1 className="text-2xl font-bold mb-2">session complete</h1>
          <p className="text-[var(--rh-text-muted)] mb-6">
            thanks for crossing with us, {displayName}.
          </p>
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

  if (state.status === "lobby") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">🛶</p>
          <h1 className="text-xl font-bold mb-2">you're in!</h1>
          <p className="text-[var(--rh-text-muted)] mb-1">
            waiting for the facilitator to start...
          </p>
          <p className="text-sm text-[var(--rh-text-muted)]">
            {Object.keys(state.participants).length} in the room
          </p>
          <div className="mt-8 px-4 py-3 rounded-xl bg-black/5 inline-block">
            <p className="text-xs text-[var(--rh-text-muted)] mb-1">
              your name
            </p>
            <p className="font-medium">{displayName}</p>
          </div>
        </div>
      </div>
    );
  }

  const activity = state.activities[state.currentActivityIndex];
  const serverSubmitted = myId && activity
    ? state.participants[myId]?.responses[activity.id] !== undefined
    : false;
  const hasSubmitted = serverSubmitted || (activity ? localSubmitted.has(activity.id) : false);
  const participantIds = Object.keys(state.participants).sort();
  const myIndex = myId ? participantIds.indexOf(myId) : 0;

  return (
    <AgeLevelProvider level={state.ageLevel || "professional"}>
    <div className="min-h-screen flex flex-col">
      {/* notifications overlay */}
      <NotificationOverlay
        notifications={notifications}
        onDismiss={dismissNotification}
      />

      {/* connection indicator + phase */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-black/5 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
            />
            {activity && (
              <span
                className={`text-xs font-medium uppercase tracking-wider text-[var(--rh-text-muted)]`}
              >
                <span className={`phase-dot phase-${activity.phase} mr-1.5`} />
                {activity.phase}
              </span>
            )}
          </div>
          {state.timer && <TimerDisplay timer={state.timer} compact />}
        </div>
      </header>

      {/* activity area */}
      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
        {activity ? (
          <ActivityRenderer
            activity={activity}
            role="participant"
            submitted={hasSubmitted}
            participantIndex={myIndex}
            onSubmit={(response) => {
              setLocalSubmitted((prev) => new Set(prev).add(activity.id));
              send({
                type: "submit",
                activityId: activity.id,
                response,
              });
            }}
          />
        ) : (
          <div className="text-center py-12 text-[var(--rh-text-muted)]">
            <p>waiting for the facilitator...</p>
          </div>
        )}
      </main>

      {/* paused overlay */}
      {state.status === "paused" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="text-center text-white">
            <p className="text-3xl mb-2">⏸</p>
            <p className="text-lg font-semibold">session paused</p>
            <p className="text-sm opacity-70 mt-1">
              the facilitator will resume shortly
            </p>
          </div>
        </div>
      )}
    </div>
    </AgeLevelProvider>
  );
}

// ── notification overlay ──────────────────────────────────────

function NotificationOverlay({
  notifications,
  onDismiss,
}: {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}) {
  if (notifications.length === 0) return null;

  const latest = notifications[notifications.length - 1];

  // auto-dismiss look-up notifications after their duration
  if (latest.type === "look-up") {
    return <LookUpOverlay notification={latest} onDismiss={onDismiss} />;
  }

  return (
    <div className="fixed top-16 left-4 right-4 z-40 animate-slide-down">
      <div className="bg-[var(--rh-teal)] text-white rounded-xl p-4 shadow-lg max-w-lg mx-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider opacity-70 mb-1">
              hint
            </p>
            <p className="text-sm">{latest.message}</p>
          </div>
          <button
            onClick={() => onDismiss(latest.id)}
            className="text-white/70 hover:text-white text-lg leading-none"
          >
            &times;
          </button>
        </div>
      </div>
    </div>
  );
}

function LookUpOverlay({
  notification,
  onDismiss,
}: {
  notification: Notification;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const duration = notification.durationMs || 5000;
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss(notification.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-[var(--rh-deep)] z-50 flex items-center justify-center px-8">
      <div className="text-center text-white max-w-md">
        <p className="text-5xl mb-6">👀</p>
        <p className="text-xl font-semibold leading-relaxed">
          {notification.message}
        </p>
        <p className="text-sm opacity-50 mt-6">look up from your screen</p>
      </div>
    </div>
  );
}
