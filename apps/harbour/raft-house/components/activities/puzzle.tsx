"use client";

import { useState } from "react";
import type { PuzzleConfig, Participant } from "@/lib/types";

interface Props {
  config: PuzzleConfig;
  role: "facilitator" | "participant";
  onSubmit?: (response: unknown) => void;
  responses?: Record<string, unknown>;
  participants?: Record<string, Participant>;
  submitted?: boolean;
}

export function PuzzleActivity({
  config,
  role,
  onSubmit,
  responses,
  participants,
  submitted,
}: Props) {
  const [order, setOrder] = useState<string[]>([]);
  const unplaced = config.pieces.filter((p) => !order.includes(p.id));

  const handlePlace = (pieceId: string) => {
    setOrder((prev) => [...prev, pieceId]);
  };

  const handleRemove = (index: number) => {
    setOrder((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (order.length !== config.pieces.length) return;
    onSubmit?.(order);
  };

  // check correctness for facilitator reveal
  const checkAnswer = (submission: string[]): number => {
    let correct = 0;
    for (let i = 0; i < config.solution.length; i++) {
      if (submission[i] === config.solution[i]) correct++;
    }
    return correct;
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">{config.prompt}</h3>

      {role === "participant" && !submitted ? (
        <div className="space-y-4">
          {/* placed sequence */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--rh-text-muted)] uppercase tracking-wider">
              your sequence ({order.length}/{config.pieces.length})
            </p>
            {order.length === 0 ? (
              <div className="py-4 text-center text-sm text-[var(--rh-text-muted)] border-2 border-dashed border-black/10 rounded-xl">
                tap pieces below to build your sequence
              </div>
            ) : (
              <div className="space-y-1.5">
                {order.map((id, i) => {
                  const piece = config.pieces.find((p) => p.id === id);
                  return (
                    <button
                      key={`placed-${id}`}
                      onClick={() => handleRemove(i)}
                      className="w-full text-left px-4 py-2.5 rounded-xl bg-[var(--rh-cyan)]/10 border border-[var(--rh-cyan)]/30 text-sm flex items-center gap-2"
                    >
                      <span className="w-5 h-5 rounded-full bg-[var(--rh-cyan)] text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="flex-1">{piece?.content}</span>
                      <span className="text-xs text-[var(--rh-text-muted)]">
                        &times;
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* unplaced pieces */}
          {unplaced.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[var(--rh-text-muted)] uppercase tracking-wider">
                available pieces
              </p>
              {unplaced.map((piece) => (
                <button
                  key={piece.id}
                  onClick={() => handlePlace(piece.id)}
                  className="w-full text-left px-4 py-2.5 rounded-xl border border-black/10 bg-white text-sm hover:border-[var(--rh-cyan)]/50 transition-colors"
                >
                  {piece.content}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-3 items-center">
            {order.length === config.pieces.length ? (
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 rounded-xl bg-[var(--rh-cyan)] text-white font-semibold hover:bg-[var(--rh-teal)] transition-colors"
              >
                lock in sequence
              </button>
            ) : <span className="flex-1" />}
            {order.length > 0 && (
              <button
                onClick={() => setOrder([])}
                className="text-xs text-[var(--rh-text-muted)] hover:text-[var(--rh-text)] transition-colors"
              >
                start over
              </button>
            )}
          </div>
        </div>
      ) : role === "participant" && submitted ? (
        <div className="text-center py-6 text-[var(--rh-text-muted)]">
          <p className="text-2xl mb-2">🧩</p>
          <p className="text-sm">sequence submitted — waiting for reveal</p>
        </div>
      ) : (
        /* facilitator view */
        <div className="space-y-4">
          {responses ? (
            <>
              {/* correct answer */}
              <div className="p-4 rounded-xl bg-[var(--rh-teal)] text-white">
                <p className="text-xs uppercase tracking-wider opacity-70 mb-2">
                  correct sequence
                </p>
                <div className="space-y-1">
                  {config.solution.map((id, i) => {
                    const piece = config.pieces.find((p) => p.id === id);
                    return (
                      <div key={id} className="flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-white/20 text-xs flex items-center justify-center font-bold">
                          {i + 1}
                        </span>
                        <span>{piece?.content}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* participant submissions */}
              <div className="space-y-2">
                {Object.entries(responses).map(([pid, response]) => {
                  const submission = response as string[];
                  const score = checkAnswer(submission);
                  return (
                    <div
                      key={pid}
                      className="px-3 py-2 rounded-xl bg-white border border-black/5"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-[var(--rh-text-muted)]">
                          {participants?.[pid]?.displayName || `participant ${Object.keys(responses).indexOf(pid) + 1}`}
                        </span>
                        <span
                          className={`text-xs font-bold ${score === config.solution.length ? "text-green-600" : "text-[var(--rh-text-muted)]"}`}
                        >
                          {score}/{config.solution.length} correct
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--rh-text-muted)]">
              sequences are hidden — click &quot;reveal results&quot; to show
            </p>
          )}
        </div>
      )}
    </div>
  );
}
