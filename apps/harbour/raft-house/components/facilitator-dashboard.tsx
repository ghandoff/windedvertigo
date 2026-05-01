"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import type { RoomState, FacilitatorMessage, AgeLevel } from "@/lib/types";
import { downloadReport, generateSessionReport } from "@/lib/export";
import { ActivityRenderer } from "./activity-renderer";
import { TimerDisplay } from "./timer-display";
import { AgeLevelProvider } from "@/lib/age-context";
import { SessionDebrief } from "./session-debrief";

interface Props {
  state: RoomState;
  send: (msg: FacilitatorMessage) => void;
  connected: boolean;
}

export function FacilitatorDashboard({ state, send, connected }: Props) {
  const activity = state.activities[state.currentActivityIndex];
  const participants = Object.values(state.participants);
  const connectedCount = participants.filter(
    (p) => p.connectionStatus === "connected",
  ).length;
  const isCampfire = state.displayMode === "shared-screen";

  const joinUrl = `https://windedvertigo.com/harbour/raft-house/play/${state.code}`;
  const [copied, setCopied] = useState(false);
  const [campfireControlsOpen, setCampfireControlsOpen] = useState(false);
  const [campfireSubmitted, setCampfireSubmitted] = useState<Set<string>>(new Set());

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [joinUrl]);

  const submittedCount = activity
    ? participants.filter((p) => p.responses[activity.id] !== undefined).length
    : 0;

  const handleAdvance = useCallback(() => send({ type: "advance" }), [send]);
  const handleReveal = useCallback(
    () => send({ type: "reveal-results" }),
    [send],
  );
  const handlePause = useCallback(
    () => send({ type: state.status === "paused" ? "resume" : "pause" }),
    [send, state.status],
  );
  const handleToggleMode = useCallback(
    () =>
      send({
        type: "set-mode",
        mode: state.mode === "sync" ? "async" : "sync",
      }),
    [send, state.mode],
  );
  const handleEndSession = useCallback(
    () => send({ type: "end-session" }),
    [send],
  );

  const handleStartTimer = useCallback(
    (seconds: number) => send({ type: "timer-start", durationMs: seconds * 1000 }),
    [send],
  );

  const handleExport = useCallback(() => downloadReport(state), [state]);

  const ageLevelLabels: Record<AgeLevel, { icon: string; label: string }> = {
    kids: { icon: "🌱", label: "kids" },
    highschool: { icon: "🌿", label: "high school" },
    professional: { icon: "🌳", label: "pro" },
  };
  const ageLevelOrder: AgeLevel[] = ["kids", "highschool", "professional"];
  const currentAgeLevel = state.ageLevel || "professional";
  const handleCycleAgeLevel = useCallback(() => {
    const idx = ageLevelOrder.indexOf(currentAgeLevel);
    const next = ageLevelOrder[(idx + 1) % ageLevelOrder.length];
    send({ type: "set-age-level", ageLevel: next });
  }, [send, currentAgeLevel]);

  const handleToggleDisplayMode = useCallback(
    () =>
      send({
        type: "set-display-mode",
        displayMode: state.displayMode === "shared-screen" ? "screenless" : "shared-screen",
      }),
    [send, state.displayMode],
  );

  // ── auto-save to Notion when session completes ─────────────────
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const savedRef = useRef(false);

  useEffect(() => {
    if (state.status !== "completed" || savedRef.current) return;
    savedRef.current = true;
    setSaveStatus("saving");

    // read session name from sessionStorage (set during session creation)
    let sessionName = state.code;
    let template = "";
    try {
      const stored = sessionStorage.getItem(`raft:${state.code}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        sessionName = parsed.sessionName || sessionName;
        template = parsed.template || "";
      }
    } catch {
      // ignore
    }

    const report = generateSessionReport(state);

    fetch("/harbour/raft-house/api/save-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionName,
        code: state.code,
        template,
        facilitator: "",
        participantCount: participants.length,
        activityCount: state.activities.length,
        date: new Date(state.createdAt).toISOString(),
        results: report,
      }),
    })
      .then((res) => {
        setSaveStatus(res.ok ? "saved" : "error");
      })
      .catch(() => {
        setSaveStatus("error");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally fire only when status transitions to completed
  }, [state.status, state.code]);

  if (state.status === "completed") {
    return (
      <SessionDebrief
        state={state}
        saveStatus={saveStatus}
        onExport={handleExport}
      />
    );
  }

  return (
    <AgeLevelProvider level={currentAgeLevel}>
    <div className="min-h-screen bg-[var(--rh-sand-light)]">
      {/* ── top bar ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-black/5 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 pulse-live" : "bg-red-500"}`}
            />
            <span className="font-mono text-lg font-bold tracking-wider">
              {state.code}
            </span>
            <span className="text-xs text-[var(--rh-text-muted)]">
              {connectedCount} connected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleDisplayMode}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-black/10 hover:bg-black/5 transition-colors"
              title={isCampfire ? "campfire mode (shared screen) — click to switch to phones" : "phones mode — click to switch to campfire"}
            >
              {isCampfire ? "🔥 campfire" : "📱 phones"}
            </button>
            <button
              onClick={handleCycleAgeLevel}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-black/10 hover:bg-black/5 transition-colors"
              title={`audience: ${ageLevelLabels[currentAgeLevel].label} — click to change`}
            >
              {ageLevelLabels[currentAgeLevel].icon} {ageLevelLabels[currentAgeLevel].label}
            </button>
            {!isCampfire && (
              <>
                <button
                  onClick={handleToggleMode}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-black/10 hover:bg-black/5 transition-colors"
                >
                  {state.mode === "sync" ? "🔒 sync" : "🔓 async"}
                </button>
                <button
                  onClick={handlePause}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-black/10 hover:bg-black/5 transition-colors"
                >
                  {state.status === "paused" ? "▶ resume" : "⏸ pause"}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── campfire (shared-screen) mode ──────────────────── */}
      {isCampfire ? (
        <div className="max-w-2xl mx-auto px-4 py-8 w-full">
          {/* progress indicator */}
          <div className="flex items-center gap-1.5 mb-6">
            {state.activities.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < state.currentActivityIndex
                    ? "bg-[var(--rh-teal)]"
                    : i === state.currentActivityIndex
                      ? "bg-[var(--rh-cyan)]"
                      : "bg-black/10"
                }`}
              />
            ))}
          </div>

          {/* phase + timer */}
          {activity && (
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span className={`phase-dot phase-${activity.phase}`} />
                <span className="text-sm font-medium uppercase tracking-wider text-[var(--rh-text-muted)]">
                  {activity.phase}
                </span>
                <span className="text-sm text-[var(--rh-text-muted)]">
                  {state.currentActivityIndex + 1}/{state.activities.length}
                </span>
              </div>
              {state.timer && <TimerDisplay timer={state.timer} />}
            </div>
          )}

          {/* activity — rendered as participant so the group can interact */}
          {activity ? (
            <div className="bg-white rounded-2xl border border-black/5 p-8 shadow-sm mb-6">
              <ActivityRenderer
                activity={activity}
                role={state.resultsRevealed ? "facilitator" : "participant"}
                submitted={campfireSubmitted.has(activity.id)}
                participantIndex={0}
                onSubmit={(response) => {
                  setCampfireSubmitted((prev) => new Set(prev).add(activity.id));
                  // store as a "campfire" participant so it shows in results
                  send({
                    type: "send-hint",
                    hint: `group response submitted`,
                  });
                }}
                responses={
                  state.resultsRevealed
                    ? Object.fromEntries(
                        Object.entries(state.participants)
                          .filter(([, p]) => p.responses[activity.id] !== undefined)
                          .map(([id, p]) => [id, p.responses[activity.id]]),
                      )
                    : undefined
                }
                participants={state.participants}
              />
            </div>
          ) : (
            <div className="text-center py-12 text-[var(--rh-text-muted)]">
              <p>no activities loaded</p>
            </div>
          )}

          {/* discussion prompt — campfire reveal */}
          {state.resultsRevealed && activity?.discussionPrompt && (
            <div className="p-4 rounded-xl bg-[var(--rh-sand)] border border-black/5">
              <p className="text-xs uppercase tracking-wider text-[var(--rh-text-muted)] mb-1">
                discussion prompt
              </p>
              <p className="text-sm font-medium">{activity.discussionPrompt}</p>
            </div>
          )}

          {/* campfire controls */}
          <div className="flex gap-3">
            {!state.resultsRevealed && activity && (
              <button
                onClick={handleReveal}
                className="flex-1 py-3 rounded-xl bg-[var(--rh-cyan)] text-white text-sm font-semibold hover:bg-[var(--rh-teal)] transition-colors"
              >
                reveal results ({submittedCount}/{participants.length})
              </button>
            )}
            {state.currentActivityIndex >= state.activities.length - 1 ? (
              <button
                onClick={handleEndSession}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                end session
              </button>
            ) : (
              <button
                onClick={handleAdvance}
                className="flex-1 py-3 rounded-xl bg-[var(--rh-deep)] text-white text-sm font-semibold hover:bg-black transition-colors"
              >
                next &rarr;
              </button>
            )}
          </div>

          {/* expandable controls drawer */}
          <div className="mt-6">
            <button
              onClick={() => setCampfireControlsOpen(!campfireControlsOpen)}
              className="text-xs text-[var(--rh-text-muted)] hover:text-[var(--rh-text)] transition-colors"
            >
              {campfireControlsOpen ? "hide controls ▲" : "more controls ▼"}
            </button>
            {campfireControlsOpen && (
              <div className="mt-3 p-4 bg-white rounded-xl border border-black/5 space-y-3">
                {/* timer */}
                <div>
                  <p className="text-xs font-medium text-[var(--rh-text-muted)] mb-2">timer</p>
                  {state.timer ? (
                    <TimerDisplay timer={state.timer} />
                  ) : (
                    <div className="flex gap-2">
                      {[60, 120, 180, 300].map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStartTimer(s)}
                          className="px-3 py-1.5 rounded-lg text-xs border border-black/10 hover:bg-black/5 transition-colors"
                        >
                          {s >= 60 ? `${s / 60}m` : `${s}s`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* activity jump */}
                <div>
                  <p className="text-xs font-medium text-[var(--rh-text-muted)] mb-2">jump to activity</p>
                  <div className="flex flex-wrap gap-1.5">
                    {state.activities.map((act, i) => (
                      <button
                        key={act.id}
                        onClick={() => send({ type: "goto", activityIndex: i })}
                        className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                          i === state.currentActivityIndex
                            ? "bg-[var(--rh-teal)] text-white"
                            : "border border-black/10 hover:bg-black/5"
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
                {/* export + end */}
                <div className="flex items-center gap-3 pt-2 border-t border-black/5">
                  <button
                    onClick={handleExport}
                    className="px-3 py-1.5 rounded-lg text-xs border border-black/10 hover:bg-black/5 transition-colors"
                  >
                    export results
                  </button>
                  <button
                    onClick={handleEndSession}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    end session
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
      /* ── phones (screenless) mode — original 3-column layout ── */
      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── left: activity sequence ────────────────────────── */}
        <div className="lg:col-span-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--rh-text-muted)] mb-3">
            activity sequence
          </h2>
          <div className="space-y-1.5">
            {state.activities.map((act, i) => {
              const isCurrent = i === state.currentActivityIndex;
              const isPast = i < state.currentActivityIndex;
              return (
                <button
                  key={act.id}
                  onClick={() => send({ type: "goto", activityIndex: i })}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2.5 ${
                    isCurrent
                      ? "bg-[var(--rh-teal)] text-white shadow-sm"
                      : isPast
                        ? "bg-black/5 text-[var(--rh-text-muted)]"
                        : "hover:bg-black/5"
                  }`}
                >
                  <span className={`phase-dot phase-${act.phase} flex-shrink-0`} />
                  <span className="flex-1 truncate">{act.label}</span>
                  {isPast && <span className="text-xs opacity-50">✓</span>}
                  {isCurrent && <span className="text-xs opacity-70">→</span>}
                </button>
              );
            })}
          </div>

          {/* timer controls */}
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--rh-text-muted)] mb-2">
              timer
            </h3>
            {state.timer ? (
              <TimerDisplay timer={state.timer} />
            ) : (
              <div className="flex gap-2">
                {[60, 120, 180, 300].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStartTimer(s)}
                    className="px-3 py-1.5 rounded-lg text-xs border border-black/10 hover:bg-black/5 transition-colors"
                  >
                    {s >= 60 ? `${s / 60}m` : `${s}s`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* session controls */}
          <div className="mt-6 pt-4 border-t border-black/10 flex items-center gap-3">
            <button
              onClick={handleExport}
              className="px-3 py-1.5 rounded-lg text-xs border border-black/10 hover:bg-black/5 transition-colors"
            >
              export results
            </button>
            <button
              onClick={handleEndSession}
              className="text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              end session
            </button>
          </div>
        </div>

        {/* ── center: current activity ──────────────────────── */}
        <div className="lg:col-span-1">
          {activity ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className={`phase-dot phase-${activity.phase}`} />
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--rh-text-muted)]">
                  {activity.phase}
                </span>
                {activity.mechanic?.interactionModel && (
                  <span className="text-xs bg-[var(--rh-foam)]/20 text-[var(--rh-teal)] px-2 py-0.5 rounded-full">
                    {activity.mechanic.interactionModel}
                  </span>
                )}
                {activity.mechanic?.socialStructure && (
                  <span className="text-xs bg-[var(--rh-foam)]/20 text-[var(--rh-teal)] px-2 py-0.5 rounded-full">
                    {activity.mechanic.socialStructure}
                  </span>
                )}
                {activity.mechanic?.tempo && (
                  <span className="text-xs bg-[var(--rh-foam)]/20 text-[var(--rh-teal)] px-2 py-0.5 rounded-full">
                    {activity.mechanic.tempo}
                  </span>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm">
                <ActivityRenderer
                  activity={activity}
                  role="facilitator"
                  responses={
                    state.resultsRevealed
                      ? Object.fromEntries(
                          Object.entries(state.participants)
                            .filter(([, p]) => p.responses[activity.id] !== undefined)
                            .map(([id, p]) => [id, p.responses[activity.id]]),
                        )
                      : undefined
                  }
                  participants={state.participants}
                />
              </div>

              {/* discussion prompt — shown after reveal */}
              {state.resultsRevealed && activity.discussionPrompt && (
                <div className="p-4 rounded-xl bg-[var(--rh-sand)] border border-black/5 mt-3">
                  <p className="text-xs uppercase tracking-wider text-[var(--rh-text-muted)] mb-1">
                    discussion prompt
                  </p>
                  <p className="text-sm font-medium">{activity.discussionPrompt}</p>
                </div>
              )}

              {/* facilitator action buttons */}
              <div className="flex gap-3 mt-4">
                {!state.resultsRevealed && (
                  <button
                    onClick={handleReveal}
                    className="flex-1 py-2.5 rounded-xl bg-[var(--rh-cyan)] text-white text-sm font-semibold hover:bg-[var(--rh-teal)] transition-colors"
                  >
                    reveal results ({submittedCount}/{participants.length})
                  </button>
                )}
                {state.currentActivityIndex >= state.activities.length - 1 ? (
                  <button
                    onClick={handleEndSession}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
                  >
                    end session
                  </button>
                ) : (
                  <button
                    onClick={handleAdvance}
                    className="flex-1 py-2.5 rounded-xl bg-[var(--rh-deep)] text-white text-sm font-semibold hover:bg-black transition-colors"
                  >
                    next &rarr;
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-[var(--rh-text-muted)]">
              <p>no activities loaded</p>
            </div>
          )}
        </div>

        {/* ── right: participant monitor ─────────────────────── */}
        <div className="lg:col-span-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--rh-text-muted)] mb-3">
            participants ({participants.length})
          </h2>

          {/* ── join link + QR code ──────────────────────────── */}
          <div className="bg-white rounded-2xl border border-black/5 p-5 mb-4 text-center">
            {participants.length === 0 && (
              <p className="text-sm text-[var(--rh-text-muted)] mb-3">
                waiting for participants...
              </p>
            )}
            <div className="inline-block p-3 bg-white rounded-xl border border-black/5">
              <QRCodeSVG
                value={joinUrl}
                size={180}
                level="M"
                bgColor="transparent"
                fgColor="var(--rh-deep, #1a1a2e)"
              />
            </div>
            <p className="font-mono text-2xl font-bold tracking-wider text-[var(--rh-text)] mt-3">
              {state.code}
            </p>
            <p className="text-xs text-[var(--rh-text-muted)] mt-1 mb-3 break-all">
              {joinUrl}
            </p>
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-black/10 hover:bg-black/5 transition-colors"
            >
              {copied ? "✓ copied" : "copy link"}
            </button>
          </div>

          {/* ── participant list ─────────────────────────────── */}
          {participants.length > 0 && (
            <div className="space-y-1.5">
              {participants.map((p) => {
                const hasResponded = activity && p.responses[activity.id] !== undefined;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-black/5"
                  >
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        p.connectionStatus === "connected"
                          ? "bg-green-500"
                          : "bg-gray-300"
                      }`}
                    />
                    <span className="flex-1 text-sm truncate">
                      {p.displayName}
                    </span>
                    {p.role === "guide" && (
                      <span className="text-xs bg-[var(--rh-sand)] px-1.5 py-0.5 rounded-full">
                        guide
                      </span>
                    )}
                    {hasResponded ? (
                      <span className="text-xs text-green-600">✓</span>
                    ) : (
                      <span className="text-xs text-[var(--rh-text-muted)]">
                        ...
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
    </AgeLevelProvider>
  );
}
