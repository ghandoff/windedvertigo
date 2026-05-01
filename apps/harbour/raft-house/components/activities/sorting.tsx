"use client";

import { useState } from "react";
import type { SortingConfig, Participant } from "@/lib/types";

interface Props {
  config: SortingConfig;
  role: "facilitator" | "participant";
  onSubmit?: (response: unknown) => void;
  responses?: Record<string, unknown>;
  participants?: Record<string, Participant>;
  submitted?: boolean;
}

export function SortingActivity({
  config,
  role,
  onSubmit,
  responses,
  participants,
  submitted,
}: Props) {
  // mapping of cardId → categoryId
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const unassigned = config.cards.filter((c) => !assignments[c.id]);
  const allAssigned = Object.keys(assignments).length === config.cards.length;

  const handleAssign = (cardId: string, categoryId: string) => {
    setAssignments((prev) => ({ ...prev, [cardId]: categoryId }));
  };

  const handleUnassign = (cardId: string) => {
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
  };

  const handleSubmit = () => {
    if (!allAssigned) return;
    onSubmit?.(assignments);
  };

  const checkScore = (submission: Record<string, string>): number => {
    if (!config.solution) return 0;
    let correct = 0;
    for (const [cardId, catId] of Object.entries(submission)) {
      if (config.solution[cardId] === catId) correct++;
    }
    return correct;
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">{config.prompt}</h3>

      {role === "participant" && !submitted ? (
        <div className="space-y-4">
          {/* unassigned cards */}
          {unassigned.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--rh-text-muted)] uppercase tracking-wider mb-2">
                cards to sort ({unassigned.length} remaining)
              </p>
              <div className="space-y-1.5">
                {unassigned.map((card) => (
                  <div
                    key={card.id}
                    className="px-4 py-2.5 rounded-xl border border-black/10 bg-white text-sm"
                  >
                    <p className="mb-2">{card.content}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {config.categories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => handleAssign(card.id, cat.id)}
                          className="px-3 py-1 rounded-full text-xs border border-[var(--rh-cyan)]/30 text-[var(--rh-teal)] hover:bg-[var(--rh-cyan)]/10 transition-colors"
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* category buckets with assigned cards */}
          <div className="space-y-3">
            {config.categories.map((cat) => {
              const assigned = config.cards.filter(
                (c) => assignments[c.id] === cat.id,
              );
              return (
                <div
                  key={cat.id}
                  className="p-3 rounded-xl border border-black/10 bg-[var(--rh-sand-light)]"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rh-text-muted)] mb-1">
                    {cat.label}
                  </p>
                  {cat.description && (
                    <p className="text-xs text-[var(--rh-text-muted)] mb-2">
                      {cat.description}
                    </p>
                  )}
                  {assigned.length === 0 ? (
                    <p className="text-xs text-[var(--rh-text-muted)] italic">
                      no cards yet
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {assigned.map((card) => (
                        <button
                          key={card.id}
                          onClick={() => handleUnassign(card.id)}
                          className="w-full text-left px-3 py-2 rounded-lg bg-white border border-black/5 text-sm flex items-center gap-2"
                        >
                          <span className="flex-1">{card.content}</span>
                          <span className="text-xs text-[var(--rh-text-muted)]">
                            &times;
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 items-center">
            {allAssigned ? (
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 rounded-xl bg-[var(--rh-cyan)] text-white font-semibold hover:bg-[var(--rh-teal)] transition-colors"
              >
                lock in sorting
              </button>
            ) : <span className="flex-1" />}
            {Object.keys(assignments).length > 0 && (
              <button
                onClick={() => setAssignments({})}
                className="text-xs text-[var(--rh-text-muted)] hover:text-[var(--rh-text)] transition-colors"
              >
                start over
              </button>
            )}
          </div>
        </div>
      ) : role === "participant" && submitted ? (
        <div className="text-center py-6 text-[var(--rh-text-muted)]">
          <p className="text-2xl mb-2">🗂️</p>
          <p className="text-sm">sorting submitted — waiting for reveal</p>
        </div>
      ) : (
        /* facilitator view */
        <div className="space-y-4">
          {responses ? (
            <>
              {/* correct answer if available */}
              {config.solution && (
                <div className="p-4 rounded-xl bg-[var(--rh-teal)] text-white">
                  <p className="text-xs uppercase tracking-wider opacity-70 mb-2">
                    correct sorting
                  </p>
                  <div className="space-y-2">
                    {config.categories.map((cat) => {
                      const correctCards = config.cards.filter(
                        (c) => config.solution?.[c.id] === cat.id,
                      );
                      return (
                        <div key={cat.id}>
                          <p className="text-xs font-bold opacity-80">
                            {cat.label}
                          </p>
                          <p className="text-sm">
                            {correctCards
                              .map((c) => c.content)
                              .join(" · ")}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* participant submissions */}
              <div className="space-y-2">
                {Object.entries(responses).map(([pid, response]) => {
                  const submission = response as Record<string, string>;
                  const score = checkScore(submission);
                  return (
                    <div
                      key={pid}
                      className="px-3 py-2 rounded-xl bg-white border border-black/5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[var(--rh-text-muted)]">
                          {participants?.[pid]?.displayName ||
                            `participant ${Object.keys(responses).indexOf(pid) + 1}`}
                        </span>
                        {config.solution && (
                          <span
                            className={`text-xs font-bold ${score === config.cards.length ? "text-green-600" : "text-[var(--rh-text-muted)]"}`}
                          >
                            {score}/{config.cards.length} correct
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--rh-text-muted)]">
              sorting results are hidden — click &quot;reveal results&quot; to
              show
            </p>
          )}
        </div>
      )}
    </div>
  );
}
