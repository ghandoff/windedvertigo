"use client";

/**
 * Evidence capture section — wraps photo, quote, and observation
 * components into a single collapsible panel.
 *
 * This section replaces the old "more details → trace evidence"
 * toggle buttons for practitioner-tier users. Lower tiers still
 * see the simple toggle buttons.
 *
 * Entitlement gating: the section renders a teaser with upgrade
 * prompt if the user isn't at practitioner level.
 *
 * Phase B — evidence capture (practitioner tier).
 */

import { useState } from "react";
import EvidencePhotoUpload, {
  type PhotoItem,
} from "./evidence-photo-upload";
import EvidenceQuote, { type QuoteItem } from "./evidence-quote";
import EvidenceObservations, {
  type ObservationItem,
  OBSERVATION_PROMPTS,
} from "./evidence-observations";

export interface EvidenceCaptureState {
  photos: PhotoItem[];
  quotes: QuoteItem[];
  observations: ObservationItem[];
}

export function createEmptyEvidenceState(): EvidenceCaptureState {
  return {
    photos: [],
    quotes: [],
    observations: OBSERVATION_PROMPTS.map((p) => ({
      promptKey: p.key,
      promptLabel: p.label,
      body: "",
    })),
  };
}

/**
 * Check whether the evidence state has any content worth saving.
 */
export function hasEvidenceContent(state: EvidenceCaptureState): boolean {
  if (state.photos.length > 0) return true;
  if (state.quotes.length > 0) return true;
  if (state.observations.some((o) => o.body.trim().length > 0)) return true;
  return false;
}

export default function EvidenceCaptureSection({
  runId,
  state,
  onChange,
  isPractitioner,
}: {
  /** Reflection ID — null if reflection hasn't been created yet. */
  runId: string | null;
  state: EvidenceCaptureState;
  onChange: (state: EvidenceCaptureState) => void;
  /** Whether the user has practitioner-level access. */
  isPractitioner: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  /* ---- teaser for non-practitioners -------------------------------- */
  if (!isPractitioner) {
    return (
      <div
        className="rounded-xl border p-5"
        style={{
          borderColor: "rgba(203, 120, 88, 0.15)",
          backgroundColor: "rgba(203, 120, 88, 0.04)",
        }}
      >
        <div className="flex items-start gap-3">
          <span className="text-lg">📸</span>
          <div>
            <h3 className="text-sm font-semibold text-cadet/80">
              capture evidence
            </h3>
            <p className="text-xs text-cadet/50 mt-1 max-w-md">
              add photos, quotes, and guided observations to turn
              your reflections into rich evidence journals.
            </p>
            <p
              className="text-xs font-medium mt-2"
              style={{ color: "var(--wv-sienna)" }}
            >
              upgrade to practitioner to unlock →
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ---- full evidence section for practitioners --------------------- */
  const itemCount =
    state.photos.length +
    state.quotes.length +
    state.observations.filter((o) => o.body.trim()).length;

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        borderColor: isOpen
          ? "rgba(203, 120, 88, 0.25)"
          : "rgba(39, 50, 72, 0.08)",
        backgroundColor: "rgba(203, 120, 88, 0.03)",
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-semibold text-cadet/80 w-full"
      >
        <span
          className="text-xs transition-transform"
          style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0)" }}
        >
          ▶
        </span>
        capture evidence
        {itemCount > 0 && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1"
            style={{
              backgroundColor: "rgba(203, 120, 88, 0.12)",
              color: "var(--wv-sienna)",
            }}
          >
            {itemCount} item{itemCount !== 1 ? "s" : ""}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="mt-5 space-y-6">
          {/* photo upload */}
          <EvidencePhotoUpload
            runId={runId}
            photos={state.photos}
            onChange={(photos) => onChange({ ...state, photos })}
          />

          {/* quote capture */}
          <EvidenceQuote
            quotes={state.quotes}
            onChange={(quotes) => onChange({ ...state, quotes })}
          />

          {/* guided observations */}
          <EvidenceObservations
            observations={state.observations}
            onChange={(observations) => onChange({ ...state, observations })}
          />
        </div>
      )}
    </div>
  );
}
