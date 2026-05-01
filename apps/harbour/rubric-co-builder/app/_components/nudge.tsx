"use client";

import { useEffect, useState } from "react";
import { apiPath } from "@/lib/paths";

type EditorProps = {
  code: string;
  currentNudge: string | null;
};

// host-side editor. lets the facilitator pin or clear a clarifying question
// that every student sees at the top of their screen.
export function FacilitatorNudgeEditor({ code, currentNudge }: EditorProps) {
  const [draft, setDraft] = useState(currentNudge ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "cleared">("idle");

  // sync local draft when server value changes (e.g., another host tab cleared it)
  useEffect(() => {
    setDraft(currentNudge ?? "");
  }, [currentNudge]);

  async function send(text: string) {
    setSaving(true);
    setStatus("idle");
    try {
      await fetch(apiPath(`/api/rooms/${code}/nudge`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setStatus(text.trim().length > 0 ? "saved" : "cleared");
      setTimeout(() => setStatus("idle"), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg bg-white border border-[color:var(--color-cadet)]/15 p-4 pointer-events-auto">
      <label
        htmlFor="nudge-input"
        className="block text-xs tracking-widest text-[color:var(--color-cadet)]/70 mb-2"
      >
        facilitator nudge · shown to every student until you clear it
      </label>
      <div className="flex flex-wrap gap-2 items-start">
        <input
          id="nudge-input"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="ask a clarifying question, or point the room somewhere"
          maxLength={300}
          className="flex-1 min-w-0 rounded border border-[color:var(--color-cadet)]/20 px-3 py-2 text-sm focus:border-[color:var(--color-cadet)] focus:outline-none"
        />
        <button
          type="button"
          disabled={saving || draft.trim() === (currentNudge ?? "").trim()}
          onClick={() => send(draft.trim())}
          className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "sending…" : "pin"}
        </button>
        {currentNudge ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setDraft("");
              send("");
            }}
            className="btn-secondary text-sm"
          >
            clear
          </button>
        ) : null}
      </div>
      {status !== "idle" ? (
        <p className="mt-2 text-xs text-[color:var(--color-cadet)]/60">
          {status === "saved" ? "pinned for the room." : "cleared."}
        </p>
      ) : null}
    </div>
  );
}

// student-side banner. renders nothing when there's no nudge.
export function FacilitatorNudgeBanner({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 rounded-lg border-l-4 border-[color:var(--color-sienna)] bg-[color:var(--color-champagne)] px-4 py-3"
    >
      <p className="text-xs tracking-widest text-[color:var(--color-cadet)]/70 mb-1">
        from the facilitator
      </p>
      <p className="text-sm text-[color:var(--color-cadet)] leading-relaxed">{text}</p>
    </div>
  );
}
