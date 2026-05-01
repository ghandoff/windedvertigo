"use client";

import { useState, useCallback } from "react";

interface FeedbackButtonProps {
  task_id: string;
  plan_id: string;
}

export function FeedbackButton({ task_id, plan_id }: FeedbackButtonProps) {
  const [rating, set_rating] = useState<number | null>(null);
  const [comment, set_comment] = useState("");
  const [submitted, set_submitted] = useState(false);
  const [expanded, set_expanded] = useState(false);

  const submit = useCallback(async () => {
    if (!rating) return;
    try {
      await fetch("/harbour/depth-chart/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id, plan_id, rating, comment: comment || null }),
      });
      set_submitted(true);
    } catch (e) {
      console.error("[feedback]", e);
    }
  }, [task_id, plan_id, rating, comment]);

  if (submitted) {
    return (
      <p className="text-xs text-[var(--color-text-on-dark-muted)]">
        thanks for your feedback!
      </p>
    );
  }

  if (!expanded) {
    return (
      <button
        onClick={() => set_expanded(true)}
        className="text-xs text-[var(--color-text-on-dark-muted)] hover:text-[var(--wv-champagne)] transition-colors"
      >
        rate this task
      </button>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
      <p className="text-xs text-[var(--color-text-on-dark-muted)]">
        how useful was this task?
      </p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => set_rating(n)}
            className={`w-8 h-8 rounded text-xs font-semibold transition-colors ${
              rating === n
                ? "bg-[var(--wv-champagne)] text-[var(--wv-cadet)]"
                : "bg-white/5 text-[var(--color-text-on-dark-muted)] hover:bg-white/10"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => set_comment(e.target.value)}
        placeholder="optional: what could be improved?"
        rows={2}
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-[var(--color-text-on-dark)] placeholder:text-white/20 resize-none focus:outline-none focus:border-[var(--wv-champagne)] transition-colors"
      />
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={!rating}
          className="px-3 py-1 text-xs font-semibold bg-[var(--wv-champagne)] text-[var(--wv-cadet)] rounded hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          submit
        </button>
        <button
          onClick={() => set_expanded(false)}
          className="px-3 py-1 text-xs text-[var(--color-text-on-dark-muted)] hover:text-[var(--color-text-on-dark)] transition-colors"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
