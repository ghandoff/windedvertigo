"use client";

/**
 * Accessibility preferences — client component.
 *
 * Two toggles:
 *   1. Reduced motion — suppresses CSS animations & transitions.
 *   2. Dyslexia-friendly font — switches to Atkinson Hyperlegible.
 *
 * Each toggle immediately updates the <html> classList for instant
 * visual feedback, then calls the API to persist to DB + cookies.
 * Cookie-first means the root layout can apply the classes server-side
 * on subsequent page loads — no flash of wrong state.
 *
 * Follows the same pattern as notification-prefs.tsx: fetch on mount,
 * optimistic updates with rollback on error.
 */

import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/api-url";

interface Prefs {
  reduceMotion: boolean;
  dyslexiaFont: boolean;
}

export default function AccessibilityPrefs() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/preferences"))
      .then((r) => r.json())
      .then((data) => {
        setPrefs({
          reduceMotion: data.reduceMotion ?? false,
          dyslexiaFont: data.dyslexiaFont ?? false,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  /**
   * Apply CSS class to <html> immediately — no waiting for a page reload.
   * The cookie (set by the API) ensures server-side consistency on the next
   * request, and the DB stores the preference for cross-device persistence.
   */
  const applyClassToHtml = useCallback(
    (className: string, enabled: boolean) => {
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle(className, enabled);
      }
    },
    [],
  );

  async function updatePrefs(updates: Partial<Prefs>) {
    if (!prefs || saving) return;

    const next = { ...prefs, ...updates };
    setPrefs(next); // optimistic

    // Apply CSS class immediately for instant visual feedback
    if (updates.reduceMotion !== undefined) {
      applyClassToHtml("reduce-motion", updates.reduceMotion);
    }
    if (updates.dyslexiaFont !== undefined) {
      applyClassToHtml("dyslexia-font", updates.dyslexiaFont);
    }

    setSaving(true);

    try {
      const res = await fetch(apiUrl("/api/preferences"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        // rollback state and CSS classes
        setPrefs(prefs);
        if (updates.reduceMotion !== undefined) {
          applyClassToHtml("reduce-motion", prefs.reduceMotion);
        }
        if (updates.dyslexiaFont !== undefined) {
          applyClassToHtml("dyslexia-font", prefs.dyslexiaFont);
        }
      }
    } catch {
      // rollback state and CSS classes
      setPrefs(prefs);
      if (updates.reduceMotion !== undefined) {
        applyClassToHtml("reduce-motion", prefs.reduceMotion);
      }
      if (updates.dyslexiaFont !== undefined) {
        applyClassToHtml("dyslexia-font", prefs.dyslexiaFont);
      }
    } finally {
      setSaving(false);
    }
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
      {/* Reduced motion toggle */}
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
              reduce motion
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--wv-cadet)", opacity: 0.45 }}
            >
              minimise animations and transitions throughout the app.
              supplements your operating system&apos;s reduced motion setting.
            </p>
          </div>

          <ToggleSwitch
            checked={prefs.reduceMotion}
            label="toggle reduced motion"
            disabled={saving}
            onToggle={() => updatePrefs({ reduceMotion: !prefs.reduceMotion })}
          />
        </div>
      </div>

      {/* Dyslexia-friendly font toggle */}
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
              dyslexia-friendly font
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--wv-cadet)", opacity: 0.45 }}
            >
              switch to atkinson hyperlegible — a typeface designed with
              distinct letterforms that reduce mirroring confusion (b/d, p/q).
            </p>
          </div>

          <ToggleSwitch
            checked={prefs.dyslexiaFont}
            label="toggle dyslexia-friendly font"
            disabled={saving}
            onToggle={() => updatePrefs({ dyslexiaFont: !prefs.dyslexiaFont })}
          />
        </div>
      </div>
    </div>
  );
}

/* ── toggle switch (extracted to keep JSX clean) ─────────────────── */

function ToggleSwitch({
  checked,
  label,
  disabled,
  onToggle,
}: {
  checked: boolean;
  label: string;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      disabled={disabled}
      className="flex-shrink-0 relative rounded-full transition-colors duration-200"
      style={{
        width: 44,
        height: 24,
        backgroundColor: checked
          ? "var(--wv-redwood)"
          : "rgba(39, 50, 72, 0.15)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        className="block rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{
          width: 20,
          height: 20,
          marginTop: 2,
          marginLeft: 2,
          transform: checked ? "translateX(20px)" : "translateX(0)",
        }}
      />
    </button>
  );
}
