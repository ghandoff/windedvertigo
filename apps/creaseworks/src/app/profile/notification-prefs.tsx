"use client";

/**
 * Notification preferences — client component.
 *
 * Manages digest and nudge email settings with frequency selector.
 * Optimistic UI updates with rollback on error.
 *
 * Session 21+: notification digest system.
 */

import { useState, useEffect } from "react";
import { apiUrl } from "@/lib/api-url";

interface Prefs {
  digestEnabled: boolean;
  digestFrequency: "weekly" | "biweekly" | "never";
  nudgeEnabled?: boolean;
}

export default function NotificationPrefs() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/notifications/prefs"))
      .then((r) => r.json())
      .then((data) => {
        setPrefs({
          digestEnabled: data.digestEnabled ?? true,
          digestFrequency: data.digestFrequency ?? "weekly",
          nudgeEnabled: data.nudgeEnabled ?? true,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function updatePrefs(updates: Partial<Prefs>) {
    if (!prefs || saving) return;

    const next = { ...prefs, ...updates };
    setPrefs(next); // optimistic
    setSaving(true);

    try {
      const res = await fetch(apiUrl("/api/notifications/prefs"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        setPrefs(prefs); // rollback
      }
    } catch {
      setPrefs(prefs); // rollback
    } finally {
      setSaving(false);
    }
  }

  function toggleDigest() {
    updatePrefs({ digestEnabled: !prefs?.digestEnabled });
  }

  function toggleNudge() {
    updatePrefs({ nudgeEnabled: !(prefs?.nudgeEnabled ?? true) });
  }

  function changeFrequency(freq: "weekly" | "biweekly" | "never") {
    updatePrefs({ digestFrequency: freq, digestEnabled: freq !== "never" });
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div
          className="animate-pulse rounded-lg h-20"
          style={{ backgroundColor: "rgba(39, 50, 72, 0.04)" }}
        />
        <div
          className="animate-pulse rounded-lg h-20"
          style={{ backgroundColor: "rgba(39, 50, 72, 0.04)" }}
        />
      </div>
    );
  }

  if (!prefs) return null;

  return (
    <div className="space-y-6">
      {/* Digest section */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: "rgba(39, 50, 72, 0.1)" }}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--wv-cadet)" }}
            >
              playdate digest
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--wv-cadet)", opacity: 0.45 }}
            >
              weekly email with playdates you haven't tried, your recent reflections, and progress.
            </p>
          </div>

          {/* toggle switch */}
          <button
            type="button"
            role="switch"
            aria-checked={prefs.digestEnabled}
            aria-label="toggle digest email"
            onClick={toggleDigest}
            disabled={saving}
            className="flex-shrink-0 relative rounded-full transition-colors duration-200"
            style={{
              width: 44,
              height: 24,
              backgroundColor: prefs.digestEnabled
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
                transform: prefs.digestEnabled
                  ? "translateX(20px)"
                  : "translateX(0)",
              }}
            />
          </button>
        </div>

        {/* frequency selector */}
        {prefs.digestEnabled && (
          <div className="mt-4">
            <p
              className="text-xs font-medium mb-2"
              style={{ color: "var(--wv-cadet)", opacity: 0.6 }}
            >
              how often
            </p>
            <div className="flex gap-2 flex-wrap">
              {(["weekly", "biweekly"] as const).map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => changeFrequency(freq)}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    backgroundColor:
                      prefs.digestFrequency === freq
                        ? "var(--wv-redwood)"
                        : "rgba(39, 50, 72, 0.06)",
                    color:
                      prefs.digestFrequency === freq
                        ? "white"
                        : "var(--wv-cadet)",
                    opacity: saving ? 0.6 : 1,
                    cursor: saving ? "not-allowed" : "pointer",
                  }}
                >
                  {freq === "weekly" ? "every monday" : "every other monday"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Nudge section */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: "rgba(39, 50, 72, 0.1)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--wv-cadet)" }}
            >
              re-engagement nudge
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--wv-cadet)", opacity: 0.45 }}
            >
              gentle email if you haven't played in a couple weeks. max once per week.
            </p>
          </div>

          {/* toggle switch */}
          <button
            type="button"
            role="switch"
            aria-checked={prefs.nudgeEnabled ?? true}
            aria-label="toggle nudge email"
            onClick={toggleNudge}
            disabled={saving}
            className="flex-shrink-0 relative rounded-full transition-colors duration-200"
            style={{
              width: 44,
              height: 24,
              backgroundColor: prefs.nudgeEnabled
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
                transform: prefs.nudgeEnabled
                  ? "translateX(20px)"
                  : "translateX(0)",
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

