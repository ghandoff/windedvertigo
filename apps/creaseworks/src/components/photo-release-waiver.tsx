"use client";

/**
 * Photo release waiver — face-tier consent.
 *
 * Digital waiver for photos containing identifiable people.
 * Captures parent/guardian name, child age range, and timestamps
 * the signature with IP (captured server-side).
 *
 * COPPA 2025 compliant — parental consent for children under 13.
 *
 * Phase 4 — engagement system.
 */

import { useState } from "react";

const AGE_RANGES = [
  "under 5",
  "5–8",
  "9–12",
  "13–17",
  "18+ (adult)",
];

export default function PhotoReleaseWaiver({
  onComplete,
  onBack,
  marketingOptIn,
  onMarketingChange,
}: {
  onComplete: (parentName: string, childAgeRange: string) => void;
  onBack: () => void;
  marketingOptIn: boolean;
  onMarketingChange: (value: boolean) => void;
}) {
  const [parentName, setParentName] = useState("");
  const [childAgeRange, setChildAgeRange] = useState("");
  const [agreed, setAgreed] = useState(false);

  const canSubmit = parentName.trim().length > 0 && childAgeRange && agreed;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onComplete(parentName.trim(), childAgeRange);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border p-5 space-y-5"
      style={{
        borderColor: "rgba(139, 69, 57, 0.2)",
        backgroundColor: "rgba(139, 69, 57, 0.03)",
      }}
    >
      <div>
        <h3 className="text-sm font-semibold text-cadet/80">
          photo release form
        </h3>
        <p className="text-xs text-cadet/50 mt-1">
          since a person is visible, we need brief consent. this protects
          everyone — especially children.
        </p>
      </div>

      {/* parent / guardian name */}
      <div>
        <label className="block text-xs font-medium text-cadet/70 mb-1">
          parent or guardian name
        </label>
        <input
          type="text"
          value={parentName}
          onChange={(e) => setParentName(e.target.value)}
          placeholder="your full name"
          className="w-full rounded-lg border border-cadet/10 px-3 py-2 text-sm text-cadet
                     placeholder:text-cadet/30 focus:border-sienna/40 focus:outline-none"
          maxLength={100}
          required
        />
      </div>

      {/* child age range */}
      <div>
        <label className="block text-xs font-medium text-cadet/70 mb-1">
          age of person in photo
        </label>
        <div className="flex flex-wrap gap-2">
          {AGE_RANGES.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setChildAgeRange(range)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                backgroundColor:
                  childAgeRange === range
                    ? "var(--wv-sienna)"
                    : "rgba(39, 50, 72, 0.05)",
                color: childAgeRange === range ? "white" : "rgba(39, 50, 72, 0.6)",
              }}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* marketing opt-in */}
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={marketingOptIn}
          onChange={(e) => onMarketingChange(e.target.checked)}
          className="mt-0.5 accent-sienna"
        />
        <div>
          <span className="text-xs text-cadet/70">
            approve for marketing use
          </span>
          <p className="text-[10px] text-cadet/35 mt-0.5">
            optional — we may feature the photo on our site or social media.
          </p>
        </div>
      </label>

      {/* consent agreement */}
      <div
        className="rounded-lg px-4 py-3 text-xs text-cadet/60 space-y-2"
        style={{ backgroundColor: "rgba(39, 50, 72, 0.03)" }}
      >
        <p>
          by checking the box below, I confirm that:
        </p>
        <ul className="list-disc pl-4 space-y-1 text-cadet/50">
          <li>
            I am the parent or legal guardian of any minor(s) in the photo, or
            I am the adult pictured and consenting for myself.
          </li>
          <li>
            I grant creaseworks permission to store and display this photo
            within the platform for my personal reflection history.
          </li>
          {marketingOptIn && (
            <li>
              I additionally grant permission for creaseworks to use this photo
              in promotional materials, social media, and community features.
            </li>
          )}
          <li>
            I understand I can revoke this consent at any time from my portfolio
            settings.
          </li>
        </ul>
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 accent-sienna"
        />
        <span className="text-xs font-medium text-cadet/70">
          I agree to the terms above
        </span>
      </label>

      {/* actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-cadet/40 hover:text-cadet/60 transition-colors"
        >
          &larr; back
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg px-5 py-2 text-xs font-medium text-white transition-all disabled:opacity-40"
          style={{ backgroundColor: "var(--wv-redwood)" }}
        >
          sign and confirm
        </button>
      </div>
    </form>
  );
}
