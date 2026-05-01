"use client";

/**
 * Guided observation prompts for evidence capture.
 *
 * Three gentle prompts that replace the old free-text "what changed"
 * and "next iteration" fields for practitioner-tier users:
 *
 *   1. "what surprised you?"
 *   2. "what did the children make?"
 *   3. "what would you change next time?"
 *
 * Each prompt maps to a prompt_key that gets stored in run_evidence
 * as an observation-type item.
 *
 * Phase B — evidence capture (practitioner tier).
 */

export interface ObservationItem {
  promptKey: string;
  promptLabel: string;
  body: string;
}

/** The standard observation prompts. */
export const OBSERVATION_PROMPTS: { key: string; label: string; placeholder: string }[] = [
  {
    key: "what_surprised",
    label: "what surprised you?",
    placeholder: "something unexpected that happened, a child's reaction, a moment that stood out…",
  },
  {
    key: "what_made",
    label: "what did the children make?",
    placeholder: "describe what was created — drawings, constructions, stories, performances…",
  },
  {
    key: "what_change",
    label: "what would you change next time?",
    placeholder: "timing, materials, grouping, instructions, environment…",
  },
];

export default function EvidenceObservations({
  observations,
  onChange,
}: {
  observations: ObservationItem[];
  onChange: (observations: ObservationItem[]) => void;
}) {
  function updateBody(promptKey: string, body: string) {
    const updated = OBSERVATION_PROMPTS.map((prompt) => {
      const existing = observations.find((o) => o.promptKey === prompt.key);
      if (prompt.key === promptKey) {
        return { promptKey: prompt.key, promptLabel: prompt.label, body };
      }
      return existing ?? { promptKey: prompt.key, promptLabel: prompt.label, body: "" };
    });
    onChange(updated);
  }

  return (
    <div className="space-y-4">
      <label className="text-xs text-cadet/60 font-medium block">
        observations
      </label>

      {OBSERVATION_PROMPTS.map((prompt) => {
        const value =
          observations.find((o) => o.promptKey === prompt.key)?.body ?? "";

        return (
          <div key={prompt.key}>
            <label className="block text-xs text-cadet/70 mb-1.5 font-medium">
              {prompt.label}
            </label>
            <textarea
              value={value}
              onChange={(e) => updateBody(prompt.key, e.target.value)}
              placeholder={prompt.placeholder}
              rows={2}
              className="w-full rounded-lg border border-cadet/15 px-3 py-2 text-sm outline-none
                         focus:ring-2 resize-y placeholder:text-cadet/30"
            />
          </div>
        );
      })}
    </div>
  );
}
