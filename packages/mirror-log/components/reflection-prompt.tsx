"use client";

/**
 * @windedvertigo/mirror-log — ReflectionPrompt
 *
 * Embeddable post-activity reflection component.
 * Any harbour app can import this and render it after an activity.
 * Handles its own prompt selection, UI, and localStorage persistence.
 */

import { useState, useCallback, useMemo } from "react";
import type { ReflectionPromptConfig, MoodType, Reflection } from "../lib/types";
import { selectPrompt } from "../lib/prompts";
import { saveReflection } from "../lib/storage";
import { MoodPicker } from "./mood-picker";

interface ReflectionPromptProps extends ReflectionPromptConfig {
  /** Called after the reflection is saved. */
  onComplete?: (reflection: Reflection) => void;
  /** Called when the user dismisses without reflecting. */
  onSkip?: () => void;
}

export function ReflectionPrompt({
  sourceApp,
  skillsExercised,
  sessionSummary,
  onComplete,
  onSkip,
}: ReflectionPromptProps) {
  const [response, setResponse] = useState("");
  const [mood, setMood] = useState<MoodType | null>(null);
  const [saved, setSaved] = useState(false);

  const prompt = useMemo(
    () => selectPrompt({ sourceApp, skillsExercised, sessionSummary }),
    [sourceApp, skillsExercised, sessionSummary],
  );

  const handleSave = useCallback(() => {
    if (!response.trim()) return;

    const reflection: Reflection = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      sourceApp,
      prompt,
      response: response.trim(),
      skillSlugs: skillsExercised,
      mood,
    };

    saveReflection(reflection);
    setSaved(true);
    onComplete?.(reflection);
  }, [response, mood, sourceApp, skillsExercised, prompt, onComplete]);

  if (saved) {
    return (
      <div className="max-w-lg mx-auto p-6 rounded-xl border border-white/10 bg-white/5 text-center">
        <p className="text-lg font-semibold text-[var(--color-text-on-dark)] mb-2">
          reflection saved
        </p>
        <p className="text-sm text-[var(--color-text-on-dark-muted)]">
          you can review your reflections anytime in mirror.log.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-6 rounded-xl border border-white/10 bg-white/5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold tracking-[0.2em] text-[var(--color-accent-on-dark)]">
          mirror.log
        </p>
        <button
          onClick={onSkip}
          className="text-xs text-[var(--color-text-on-dark-muted)] hover:text-[var(--color-text-on-dark)] transition-colors"
        >
          skip
        </button>
      </div>

      <p className="text-lg font-semibold text-[var(--color-text-on-dark)] mb-4 leading-relaxed">
        {prompt}
      </p>

      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="take a moment to think..."
        rows={4}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-[var(--color-text-on-dark)] placeholder:text-[var(--color-text-on-dark-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] resize-none"
        aria-label="Your reflection"
      />

      <div className="flex items-center justify-between mt-4">
        <MoodPicker value={mood} onChange={setMood} />

        <button
          onClick={handleSave}
          disabled={!response.trim()}
          className="px-5 py-2 rounded-full bg-[var(--wv-redwood)] text-[var(--color-text-on-dark)] text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          save reflection
        </button>
      </div>
    </div>
  );
}
