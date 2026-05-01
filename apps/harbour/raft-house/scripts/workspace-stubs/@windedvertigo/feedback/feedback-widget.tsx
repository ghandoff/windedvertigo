"use client";

/**
 * Floating feedback widget for harbour apps.
 *
 * Renders a small button in the bottom-right corner. On tap, expands
 * into a compact form that auto-captures device context and only asks
 * the tester for: type, severity, and an optional comment.
 *
 * Drop into any harbour app's layout.tsx:
 *   <FeedbackWidget appSlug="orbit-lab" />
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { FeedbackType } from "./types";

const TYPE_OPTIONS: { value: FeedbackType; label: string; icon: string }[] = [
  { value: "bug", label: "bug", icon: "🔴" },
  { value: "confusing", label: "confusing", icon: "🟡" },
  { value: "idea", label: "idea", icon: "💡" },
  { value: "other", label: "other", icon: "💬" },
];

interface FeedbackWidgetProps {
  appSlug: string;
}

export function FeedbackWidget({ appSlug }: FeedbackWidgetProps) {
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [severity, setSeverity] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // auto-dismiss after submit
  useEffect(() => {
    if (!submitted) return;
    const t = setTimeout(() => {
      setSubmitted(false);
      setOpen(false);
      setFeedbackType(null);
      setSeverity(null);
      setComment("");
    }, 2000);
    return () => clearTimeout(t);
  }, [submitted]);

  const submit = useCallback(async () => {
    if (!feedbackType || !severity) return;
    setSubmitting(true);

    const device_info = {
      ua: navigator.userAgent,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      platform: navigator.platform || "unknown",
    };

    try {
      await fetch(`/harbour/${appSlug}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_slug: appSlug,
          route: window.location.pathname,
          feedback_type: feedbackType,
          severity,
          comment: comment.trim() || null,
          device_info,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      console.error("[feedback]", err);
    } finally {
      setSubmitting(false);
    }
  }, [appSlug, feedbackType, severity, comment]);

  // floating button
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="send feedback"
        className="fixed bottom-4 right-4 z-50 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-lg flex items-center justify-center transition-all hover:scale-110 backdrop-blur-sm"
      >
        🐛
      </button>
    );
  }

  // submitted state
  if (submitted) {
    return (
      <div
        ref={panelRef}
        className="fixed bottom-4 right-4 z-50 w-72 rounded-2xl border border-white/10 bg-[var(--color-surface-raised)] p-5 text-center backdrop-blur-sm"
      >
        <p className="text-2xl mb-1">✓</p>
        <p className="text-sm text-[var(--color-text-on-dark-muted)]">
          thanks for your feedback!
        </p>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="fixed bottom-4 right-4 z-50 w-80 rounded-2xl border border-white/10 bg-[var(--color-surface-raised)] p-4 space-y-3 backdrop-blur-sm shadow-2xl"
    >
      {/* header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">feedback</p>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-[var(--color-text-on-dark-muted)] hover:text-[var(--color-text-on-dark)]"
          aria-label="close feedback"
        >
          ✕
        </button>
      </div>

      {/* type selector */}
      <div className="flex gap-1.5">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFeedbackType(opt.value)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              feedbackType === opt.value
                ? "bg-[var(--wv-champagne)] text-[var(--wv-cadet)]"
                : "bg-white/5 text-[var(--color-text-on-dark-muted)] hover:bg-white/10"
            }`}
          >
            <span className="block text-base leading-none mb-0.5">
              {opt.icon}
            </span>
            {opt.label}
          </button>
        ))}
      </div>

      {/* severity */}
      <div>
        <p className="text-xs text-[var(--color-text-on-dark-muted)] mb-1.5">
          how bad is it?
        </p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setSeverity(n)}
              className={`flex-1 h-8 rounded text-xs font-semibold transition-colors ${
                severity === n
                  ? "bg-[var(--wv-champagne)] text-[var(--wv-cadet)]"
                  : "bg-white/5 text-[var(--color-text-on-dark-muted)] hover:bg-white/10"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-[var(--color-text-on-dark-muted)] mt-0.5 px-0.5">
          <span>minor</span>
          <span>critical</span>
        </div>
      </div>

      {/* comment */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="what happened? (optional)"
        rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-[var(--color-text-on-dark)] placeholder:text-white/20 resize-none focus:outline-none focus:border-[var(--wv-champagne)] transition-colors"
      />

      {/* submit */}
      <button
        onClick={submit}
        disabled={!feedbackType || !severity || submitting}
        className="w-full py-2 text-sm font-semibold bg-[var(--wv-champagne)] text-[var(--wv-cadet)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {submitting ? "sending..." : "send feedback"}
      </button>
    </div>
  );
}
