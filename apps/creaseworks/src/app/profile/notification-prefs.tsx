"use client";

/**
 * Notification preferences toggle — client component.
 *
 * Fetches prefs on mount, toggles digest on/off with optimistic UI.
 *
 * Session 21: notification digest system.
 */

import { useState, useEffect } from "react";

export default function NotificationPrefs() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/notifications/prefs")
      .then((r) => r.json())
      .then((data) => {
        setEnabled(data.digestEnabled ?? true);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function toggle() {
    if (enabled === null || saving) return;

    const next = !enabled;
    setEnabled(next); // optimistic
    setSaving(true);

    try {
      const res = await fetch("/api/notifications/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestEnabled: next }),
      });

      if (!res.ok) {
        setEnabled(!next); // rollback
      }
    } catch {
      setEnabled(!next); // rollback
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        className="animate-pulse rounded-lg h-12"
        style={{ backgroundColor: "rgba(39, 50, 72, 0.04)" }}
      />
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p
          className="text-sm font-medium"
          style={{ color: "var(--wv-cadet)" }}
        >
          weekly playdate digest
        </p>
        <p
          className="text-xs mt-0.5"
          style={{ color: "var(--wv-cadet)", opacity: 0.45 }}
        >
          a short email each monday with new playdates and your recent reflections.
        </p>
      </div>

      {/* toggle switch */}
      <button
        type="button"
        role="switch"
        aria-checked={enabled ?? false}
        aria-label="toggle weekly digest"
        onClick={toggle}
        disabled={saving}
        className="flex-shrink-0 relative rounded-full transition-colors duration-200"
        style={{
          width: 44,
          height: 24,
          backgroundColor: enabled
            ? "var(--wv-redwood)"
            : "rgba(39, 50, 72, 0.15)",
          opacity: saving ? 0.6 : 1,
        }}
      >
        <span
          className="block rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{
            width: 20,
            height: 20,
            marginTop: 2,
            marginLeft: 2,
            transform: enabled ? "translateX(20px)" : "translateX(0)",
          }}
        />
      </button>
    </div>
  );
}
