"use client";

/**
 * Floating feedback widget for harbour apps.
 *
 * Renders a small button in the bottom-right corner. On tap, expands
 * into a compact form that auto-captures device context and only asks
 * the tester for: type, severity, and an optional comment.
 *
 * Uses inline styles exclusively so it works in any harbour app
 * without needing Tailwind @source configuration.
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

/* ── shared style fragments ─────────────────────────────────── */

const PANEL_BASE: React.CSSProperties = {
  position: "fixed",
  bottom: 16,
  right: 16,
  zIndex: 9999,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.1)",
  backgroundColor: "var(--color-surface-raised, #1e2738)",
  backdropFilter: "blur(4px)",
  fontFamily: "var(--font-body, system-ui, sans-serif)",
  color: "var(--color-text-on-dark, #ffebd2)",
};

const MUTED: React.CSSProperties = {
  color: "var(--color-text-on-dark-muted, rgba(255,235,210,0.5))",
};

const ACTIVE_BG: React.CSSProperties = {
  backgroundColor: "var(--wv-champagne, #ffebd2)",
  color: "var(--wv-cadet, #273248)",
};

const INACTIVE_BG: React.CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.05)",
  color: "var(--color-text-on-dark-muted, rgba(255,235,210,0.5))",
};

/* ── component ──────────────────────────────────────────────── */

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
  const [hover, setHover] = useState(false);
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

  /* ── floating button (closed state) ──────────────────────── */
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label="send feedback"
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 9999,
          width: 44,
          height: 44,
          borderRadius: "50%",
          backgroundColor: hover ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.1)",
          fontSize: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.15s ease",
          transform: hover ? "scale(1.1)" : "scale(1)",
          backdropFilter: "blur(4px)",
          padding: 0,
          lineHeight: 1,
        }}
      >
        🐛
      </button>
    );
  }

  /* ── submitted state ─────────────────────────────────────── */
  if (submitted) {
    return (
      <div ref={panelRef} style={{ ...PANEL_BASE, width: 288, padding: 20, textAlign: "center" }}>
        <p style={{ fontSize: 24, marginBottom: 4 }}>✓</p>
        <p style={{ fontSize: 14, ...MUTED }}>thanks for your feedback!</p>
      </div>
    );
  }

  /* ── form (open state) ───────────────────────────────────── */
  return (
    <div
      ref={panelRef}
      style={{ ...PANEL_BASE, width: 320, padding: 16, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}
    >
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>feedback</p>
        <button
          onClick={() => setOpen(false)}
          aria-label="close feedback"
          style={{
            fontSize: 12,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px 4px",
            ...MUTED,
          }}
        >
          ✕
        </button>
      </div>

      {/* type selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFeedbackType(opt.value)}
            style={{
              flex: 1,
              padding: "6px 0",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
              ...(feedbackType === opt.value ? ACTIVE_BG : INACTIVE_BG),
            }}
          >
            <span style={{ display: "block", fontSize: 16, lineHeight: 1, marginBottom: 2 }}>
              {opt.icon}
            </span>
            {opt.label}
          </button>
        ))}
      </div>

      {/* severity */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 12, marginBottom: 6, margin: "0 0 6px 0", ...MUTED }}>how bad is it?</p>
        <div style={{ display: "flex", gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setSeverity(n)}
              style={{
                flex: 1,
                height: 32,
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
                ...(severity === n ? ACTIVE_BG : INACTIVE_BG),
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 2, padding: "0 2px", ...MUTED }}>
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
        style={{
          width: "100%",
          backgroundColor: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 14,
          color: "var(--color-text-on-dark, #ffebd2)",
          resize: "none",
          outline: "none",
          fontFamily: "inherit",
          marginBottom: 12,
          boxSizing: "border-box",
        }}
      />

      {/* submit */}
      <button
        onClick={submit}
        disabled={!feedbackType || !severity || submitting}
        style={{
          width: "100%",
          padding: "8px 0",
          fontSize: 14,
          fontWeight: 600,
          backgroundColor: "var(--wv-champagne, #ffebd2)",
          color: "var(--wv-cadet, #273248)",
          borderRadius: 8,
          border: "none",
          cursor: (!feedbackType || !severity || submitting) ? "default" : "pointer",
          opacity: (!feedbackType || !severity || submitting) ? 0.4 : 1,
          transition: "opacity 0.15s ease",
        }}
      >
        {submitting ? "sending..." : "send feedback"}
      </button>
    </div>
  );
}
