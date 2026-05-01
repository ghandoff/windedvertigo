"use client";

/**
 * Accessibility preferences — client component.
 *
 * Four toggles:
 *   1. UI mode — kid (default, bright + playful) vs grown-up (quieter,
 *      muted). Flips the harbour character cast register and turns down
 *      the kid-only chrome (big wobble tiles, crayon-drawer rhythm).
 *   2. Calm theme — warm dark backgrounds, muted accents for sensory
 *      sensitivity (autism spectrum, migraines, ADHD overstimulation).
 *   3. Reduced motion — suppresses CSS animations & transitions.
 *   4. Dyslexia-friendly font — switches to Atkinson Hyperlegible.
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

type UiMode = "kid" | "grownup";

interface Prefs {
  reduceMotion: boolean;
  dyslexiaFont: boolean;
  calmTheme: boolean;
  uiMode: UiMode;
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
          calmTheme: data.calmTheme ?? false,
          // kid is the product's default register — an existing 'grownup'
          // user opted in deliberately via the toggle below.
          uiMode: data.uiMode === "grownup" ? "grownup" : "kid",
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
    if (updates.calmTheme !== undefined) {
      applyClassToHtml("calm-theme", updates.calmTheme);
    }
    if (updates.uiMode !== undefined) {
      applyClassToHtml("grownup-mode", updates.uiMode === "grownup");
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
        if (updates.calmTheme !== undefined) {
          applyClassToHtml("calm-theme", prefs.calmTheme);
        }
        if (updates.uiMode !== undefined) {
          applyClassToHtml("grownup-mode", prefs.uiMode === "grownup");
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
      if (updates.calmTheme !== undefined) {
        applyClassToHtml("calm-theme", prefs.calmTheme);
      }
      if (updates.uiMode !== undefined) {
        applyClassToHtml("grownup-mode", prefs.uiMode === "grownup");
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
          style={{ backgroundColor: "var(--cw-skeleton-bg)" }}
        />
        <div
          className="animate-pulse rounded-lg h-20"
          style={{ backgroundColor: "var(--cw-skeleton-bg)" }}
        />
        <div
          className="animate-pulse rounded-lg h-20"
          style={{ backgroundColor: "var(--cw-skeleton-bg)" }}
        />
      </div>
    );
  }

  if (!prefs) return null;

  return (
    <div className="space-y-6">
      {/* UI mode — kid (default) vs grownup. First because it changes the
          whole app register (character cast tone, tile wobble, layout
          rhythm), and kids should never see this toggle flipped on them
          by accident.                                                    */}
      <div
        className="cw-a11y-card rounded-lg border p-4"
        style={{ borderColor: "var(--cw-border)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--cw-text)" }}
            >
              grown-up interface
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--cw-text-muted)" }}
            >
              creaseworks defaults to <em>kid mode</em> — bright tiles,
              the harbour character cast in their playful register, crayon-
              drawer rhythm. flip this on for a quieter grown-up voice
              (muted cast, calmer chrome) when you&apos;re planning without
              the kids in the room.
            </p>
          </div>

          <ToggleSwitch
            checked={prefs.uiMode === "grownup"}
            label="toggle grown-up interface"
            disabled={saving}
            onToggle={() =>
              updatePrefs({
                uiMode: prefs.uiMode === "grownup" ? "kid" : "grownup",
              })
            }
          />
        </div>
      </div>

      {/* Calm theme toggle — orthogonal to kid/grownup; affects colour
          palette for sensory sensitivity regardless of register.         */}
      <div
        className="cw-a11y-card rounded-lg border p-4"
        style={{ borderColor: "var(--cw-border)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--cw-text)" }}
            >
              calm mode
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--cw-text-muted)" }}
            >
              warm dark backgrounds with muted colours. designed for sensory
              sensitivity, migraines, or when you just need less visual
              stimulation.
            </p>
          </div>

          <ToggleSwitch
            checked={prefs.calmTheme}
            label="toggle calm mode"
            disabled={saving}
            onToggle={() => updatePrefs({ calmTheme: !prefs.calmTheme })}
          />
        </div>
      </div>

      {/* Reduced motion toggle */}
      <div
        className="cw-a11y-card rounded-lg border p-4"
        style={{ borderColor: "var(--cw-border)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--cw-text)" }}
            >
              reduce motion
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--cw-text-muted)" }}
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
        className="cw-a11y-card rounded-lg border p-4"
        style={{ borderColor: "var(--cw-border)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--cw-text)" }}
            >
              dyslexia-friendly font
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--cw-text-muted)" }}
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
          : "var(--cw-toggle-off)",
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
