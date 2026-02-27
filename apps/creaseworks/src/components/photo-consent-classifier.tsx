"use client";

/**
 * Photo consent classifier — COPPA 2025 three-tier system.
 *
 * After a user adds photos, this component asks:
 * "What did you capture?" → artifact / activity / face
 *
 * - artifact: auto-approved for marketing (craft, drawing, built thing)
 * - activity: shows marketing opt-in checkbox (hands at work, environment)
 * - face:     triggers PhotoReleaseWaiver (identifiable person, child)
 *
 * Phase 4 — engagement system.
 */

import { useState } from "react";
import PhotoReleaseWaiver from "./photo-release-waiver";

export type ConsentTier = "artifact" | "activity" | "face";

export interface PhotoConsentDecision {
  tier: ConsentTier;
  marketingApproved: boolean;
  /** Face-tier waiver fields */
  parentName?: string;
  childAgeRange?: string;
}

const TIER_OPTIONS = [
  {
    tier: "artifact" as const,
    emoji: "🎨",
    label: "something we made",
    description: "a craft, drawing, recipe, or built thing — no people visible",
    autoMarketing: true,
  },
  {
    tier: "activity" as const,
    emoji: "✋",
    label: "an activity in progress",
    description: "hands at work, play setup, or the environment — no faces",
    autoMarketing: false,
  },
  {
    tier: "face" as const,
    emoji: "👤",
    label: "a person is visible",
    description: "someone's face or identifiable features are in the photo",
    autoMarketing: false,
  },
];

export default function PhotoConsentClassifier({
  photoCount,
  onComplete,
  onSkip,
}: {
  photoCount: number;
  onComplete: (decision: PhotoConsentDecision) => void;
  onSkip: () => void;
}) {
  const [selectedTier, setSelectedTier] = useState<ConsentTier | null>(null);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [showWaiver, setShowWaiver] = useState(false);

  function handleTierSelect(tier: ConsentTier) {
    setSelectedTier(tier);
    setMarketingOptIn(false);
    setShowWaiver(false);
  }

  function handleConfirm() {
    if (!selectedTier) return;

    if (selectedTier === "face") {
      setShowWaiver(true);
      return;
    }

    const option = TIER_OPTIONS.find((o) => o.tier === selectedTier);
    onComplete({
      tier: selectedTier,
      marketingApproved: option?.autoMarketing ?? marketingOptIn,
    });
  }

  function handleWaiverComplete(parentName: string, childAgeRange: string) {
    onComplete({
      tier: "face",
      marketingApproved: marketingOptIn,
      parentName,
      childAgeRange,
    });
  }

  // ── face-tier waiver flow ──
  if (showWaiver) {
    return (
      <PhotoReleaseWaiver
        onComplete={handleWaiverComplete}
        onBack={() => setShowWaiver(false)}
        marketingOptIn={marketingOptIn}
        onMarketingChange={setMarketingOptIn}
      />
    );
  }

  return (
    <div
      className="rounded-xl border p-5 space-y-4"
      style={{
        borderColor: "rgba(203, 120, 88, 0.2)",
        backgroundColor: "rgba(203, 120, 88, 0.04)",
      }}
    >
      <div>
        <h3 className="text-sm font-semibold text-cadet/80">
          about your photo{photoCount !== 1 ? "s" : ""}
        </h3>
        <p className="text-xs text-cadet/50 mt-1">
          help us handle your photos responsibly. what did you capture?
        </p>
      </div>

      {/* tier options */}
      <div className="space-y-2">
        {TIER_OPTIONS.map((option) => (
          <button
            key={option.tier}
            type="button"
            onClick={() => handleTierSelect(option.tier)}
            className="w-full text-left rounded-lg border px-4 py-3 transition-all"
            style={{
              borderColor:
                selectedTier === option.tier
                  ? "var(--wv-sienna)"
                  : "rgba(39, 50, 72, 0.08)",
              backgroundColor:
                selectedTier === option.tier
                  ? "rgba(203, 120, 88, 0.08)"
                  : "transparent",
            }}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg">{option.emoji}</span>
              <div>
                <span className="text-sm font-medium text-cadet/80">
                  {option.label}
                </span>
                <p className="text-xs text-cadet/40 mt-0.5">
                  {option.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* activity tier: marketing opt-in */}
      {selectedTier === "activity" && (
        <label className="flex items-start gap-2 px-1 cursor-pointer">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
            className="mt-0.5 accent-sienna"
          />
          <div>
            <span className="text-xs text-cadet/70">
              i&apos;m happy for creaseworks to use this in materials
            </span>
            <p className="text-[10px] text-cadet/35 mt-0.5">
              we may feature it on our site or social media. you can revoke this
              anytime from your portfolio.
            </p>
          </div>
        </label>
      )}

      {/* artifact tier: auto-consent note */}
      {selectedTier === "artifact" && (
        <p className="text-[10px] text-cadet/40 px-1">
          artifacts without people are automatically eligible for community
          features. you can change this anytime in your portfolio.
        </p>
      )}

      {/* face tier: waiver warning */}
      {selectedTier === "face" && (
        <div
          className="rounded-lg px-4 py-3"
          style={{ backgroundColor: "rgba(139, 69, 57, 0.06)" }}
        >
          <p className="text-xs text-cadet/60">
            photos with identifiable people require a brief release form.
            we take privacy seriously — especially for children.
          </p>
          <label className="flex items-start gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-0.5 accent-sienna"
            />
            <span className="text-xs text-cadet/60">
              also approve for marketing use (optional)
            </span>
          </label>
        </div>
      )}

      {/* actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-cadet/40 hover:text-cadet/60 transition-colors"
        >
          skip for now
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selectedTier}
          className="rounded-lg px-5 py-2 text-xs font-medium text-white transition-all disabled:opacity-40"
          style={{ backgroundColor: "var(--wv-redwood)" }}
        >
          {selectedTier === "face" ? "continue to waiver" : "confirm"}
        </button>
      </div>
    </div>
  );
}
