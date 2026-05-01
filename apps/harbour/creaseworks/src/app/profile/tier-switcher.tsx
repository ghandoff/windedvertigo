"use client";

/**
 * Tier switcher — compact 3-option selector for the manage section.
 *
 * Follows the AccessibilityPrefs pattern:
 *   1. Optimistic UI update (set state immediately)
 *   2. Apply `tier-{value}` CSS class on <html> for instant visual feedback
 *   3. PATCH /api/preferences to persist to DB + cookie
 *   4. Rollback on error
 *
 * The cookie ensures the root layout can apply the correct `tier-*` class
 * server-side on subsequent page loads (no flash).
 *
 * Tiers are cosmetic — they control nav/profile visibility, not access.
 */

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { apiUrl } from "@/lib/api-url";

type Tier = "casual" | "curious" | "collaborator";

interface TierOption {
  value: Tier;
  label: string;
  emoji: string;
  desc: string;
}

const FALLBACK_TIERS: TierOption[] = [
  {
    value: "casual",
    label: "just play",
    emoji: "🎈",
    desc: "simple play ideas, no tracking",
  },
  {
    value: "curious",
    label: "play + learn",
    emoji: "📖",
    desc: "ideas with developmental context",
  },
  {
    value: "collaborator",
    label: "play + grow",
    emoji: "🌱",
    desc: "reflections, community, evidence",
  },
];

export default function TierSwitcher({
  initialTier,
  tierOptions,
}: {
  initialTier: string;
  tierOptions?: TierOption[];
}) {
  const { update: updateSession } = useSession();
  const [tier, setTier] = useState<Tier>((initialTier as Tier) || "casual");
  const [saving, setSaving] = useState(false);

  /**
   * Swap the tier-* class on <html> immediately — mirrors the
   * AccessibilityPrefs applyClassToHtml pattern but for tier classes.
   */
  const applyTierClass = useCallback((newTier: Tier) => {
    if (typeof document !== "undefined") {
      const html = document.documentElement;
      // Remove all tier classes, then add the new one
      html.classList.remove("tier-casual", "tier-curious", "tier-collaborator");
      html.classList.add(`tier-${newTier}`);
    }
  }, []);

  async function changeTier(newTier: Tier) {
    if (newTier === tier || saving) return;

    const prevTier = tier;
    setTier(newTier);        // optimistic
    applyTierClass(newTier); // instant CSS
    setSaving(true);

    try {
      const res = await fetch(apiUrl("/api/preferences"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uiTier: newTier }),
      });

      if (!res.ok) {
        // rollback
        setTier(prevTier);
        applyTierClass(prevTier);
      } else {
        // Refresh NextAuth session so nav bar picks up the new tier
        // without requiring a full page reload
        await updateSession();
      }
    } catch {
      // rollback
      setTier(prevTier);
      applyTierClass(prevTier);
    } finally {
      setSaving(false);
    }
  }

  const options = tierOptions ?? FALLBACK_TIERS;

  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const isSelected = tier === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => changeTier(opt.value)}
            disabled={saving}
            className="w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all duration-150"
            style={{
              borderColor: isSelected
                ? "rgba(203, 120, 88, 0.35)"
                : "var(--cw-border)",
              backgroundColor: isSelected
                ? "rgba(255, 235, 210, 0.15)"
                : "transparent",
              opacity: saving ? 0.7 : 1,
            }}
            aria-pressed={isSelected}
          >
            {/* radio circle */}
            <span
              className="flex-shrink-0 flex items-center justify-center rounded-full border-2 transition-colors"
              style={{
                width: 20,
                height: 20,
                borderColor: isSelected
                  ? "var(--wv-sienna)"
                  : "rgba(39, 50, 72, 0.15)",
              }}
            >
              {isSelected && (
                <span
                  className="block rounded-full"
                  style={{
                    width: 10,
                    height: 10,
                    backgroundColor: "var(--wv-sienna)",
                  }}
                />
              )}
            </span>

            {/* emoji */}
            <span className="text-lg flex-shrink-0" aria-hidden="true">
              {opt.emoji}
            </span>

            {/* text */}
            <div className="min-w-0">
              <p
                className="text-sm font-medium"
                style={{
                  color: isSelected ? "var(--wv-sienna)" : "var(--cw-text)",
                }}
              >
                {opt.label}
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--cw-text-muted)" }}
              >
                {opt.desc}
              </p>
            </div>
          </button>
        );
      })}

      <p
        className="text-xs mt-2 pl-1"
        style={{ color: "var(--cw-text-muted)" }}
      >
        this changes which features appear in navigation — you can always
        access everything via direct link.
      </p>
    </div>
  );
}
