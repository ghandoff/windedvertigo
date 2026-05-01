"use client";

import { useState } from "react";
import type { AsymmetricConfig, Participant } from "@/lib/types";
import { useAgeLevel } from "@/lib/age-context";

interface Props {
  config: AsymmetricConfig;
  role: "facilitator" | "participant";
  onSubmit?: (response: unknown) => void;
  responses?: Record<string, unknown>;
  participants?: Record<string, Participant>;
  submitted?: boolean;
  participantIndex?: number;
}

export function AsymmetricActivity({
  config,
  role,
  onSubmit,
  responses,
  participants,
  submitted,
  participantIndex = 0,
}: Props) {
  const ageLevel = useAgeLevel();
  const [answer, setAnswer] = useState("");
  const [expanded, setExpanded] = useState(false);

  // assign role based on participant index (round-robin)
  const assignedRole =
    config.roles[participantIndex % config.roles.length];

  // at kids level, condense role info to first 2 sentences with "read more"
  const condensedInfo = ageLevel === "kids"
    ? (() => {
        const sentences = assignedRole.info.match(/[^.!?]+[.!?]+/g) || [assignedRole.info];
        return sentences.length > 2
          ? { short: sentences.slice(0, 2).join("").trim(), hasMore: true }
          : { short: assignedRole.info, hasMore: false };
      })()
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    onSubmit?.({
      roleId: assignedRole.id,
      roleLabel: assignedRole.label,
      answer: answer.trim(),
    });
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">{config.scenario}</h3>

      {role === "participant" && !submitted ? (
        <div className="space-y-4">
          {/* role card */}
          <div className="p-4 rounded-xl bg-[var(--rh-deep)] text-white">
            <p className="text-xs uppercase tracking-wider opacity-60 mb-1">
              {ageLevel === "kids" ? "you are..." : "your perspective"}
            </p>
            <p className="font-semibold mb-2">{assignedRole.label}</p>
            {condensedInfo && !expanded ? (
              <div>
                <p className="text-sm leading-relaxed opacity-90">
                  {condensedInfo.short}
                </p>
                {condensedInfo.hasMore && (
                  <button
                    onClick={() => setExpanded(true)}
                    className="text-xs text-[var(--rh-cyan)] mt-1.5 hover:underline"
                  >
                    read more →
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm leading-relaxed opacity-90">
                {assignedRole.info}
              </p>
            )}
          </div>

          {/* their unique question */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-sm font-medium">{assignedRole.question}</p>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="share from your perspective..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[var(--rh-cyan)] focus:border-transparent"
              autoFocus
            />
            <button
              type="submit"
              disabled={!answer.trim()}
              className="w-full py-3 rounded-xl bg-[var(--rh-cyan)] text-white font-semibold hover:bg-[var(--rh-teal)] transition-colors disabled:opacity-30"
            >
              share perspective
            </button>
          </form>

          <p className="text-xs text-[var(--rh-text-muted)] text-center">
            others have different information than you — that&apos;s the point
          </p>
        </div>
      ) : role === "participant" && submitted ? (
        <div className="text-center py-6 text-[var(--rh-text-muted)]">
          <p className="text-2xl mb-2">🔍</p>
          <p className="text-sm">
            perspective shared — wait for the group reveal
          </p>
        </div>
      ) : (
        /* facilitator view */
        <div className="space-y-4">
          <p className="text-sm text-[var(--rh-text-muted)] mb-2">
            {config.roles.length} perspectives in play
          </p>

          {responses ? (
            <>
              {/* discussion prompt */}
              <div className="p-4 rounded-xl bg-[var(--rh-sand)] border border-black/5">
                <p className="text-xs uppercase tracking-wider text-[var(--rh-text-muted)] mb-1">
                  discussion prompt
                </p>
                <p className="text-sm font-medium">
                  {config.discussionPrompt}
                </p>
              </div>

              {/* grouped by role */}
              {config.roles.map((r) => {
                const roleResponses = Object.entries(responses).filter(
                  ([, resp]) =>
                    (resp as { roleId: string }).roleId === r.id,
                );
                return (
                  <div key={r.id}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rh-text-muted)] mb-1.5">
                      {r.label} ({roleResponses.length})
                    </p>
                    <div className="space-y-1.5">
                      {roleResponses.map(([pid, resp]) => (
                        <div
                          key={pid}
                          className="p-3 rounded-xl bg-white border border-black/5"
                        >
                          <p className="text-xs text-[var(--rh-text-muted)] mb-1">
                            {participants?.[pid]?.displayName ||
                              `participant ${Object.keys(responses).indexOf(pid) + 1}`}
                          </p>
                          <p className="text-sm">
                            {(resp as { answer: string }).answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* reveal */}
              {config.revealPrompt && (
                <div className="p-4 rounded-xl bg-[var(--rh-teal)] text-white text-center">
                  <p className="text-xs uppercase tracking-wider opacity-70 mb-1">
                    the reveal
                  </p>
                  <p className="text-sm">{config.revealPrompt}</p>
                </div>
              )}
            </>
          ) : (
            <div>
              <p className="text-sm text-[var(--rh-text-muted)] mb-3">
                perspectives are hidden — reveal to start discussion
              </p>
              {/* show role distribution */}
              <div className={`grid gap-2 ${config.roles.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
                {config.roles.map((r) => (
                  <div
                    key={r.id}
                    className="p-2 rounded-lg bg-black/5 text-xs text-center"
                  >
                    {r.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
