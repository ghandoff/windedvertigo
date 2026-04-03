"use client";

/**
 * @windedvertigo/mirror-log — MoodPicker
 *
 * Simple emoji mood selector for reflections.
 */

import type { MoodType } from "../lib/types";

interface MoodPickerProps {
  value: MoodType | null;
  onChange: (mood: MoodType) => void;
}

const MOODS: { type: MoodType; emoji: string; label: string }[] = [
  { type: "energized", emoji: "⚡", label: "energized" },
  { type: "curious", emoji: "🔍", label: "curious" },
  { type: "calm", emoji: "🌊", label: "calm" },
  { type: "uncertain", emoji: "🌀", label: "uncertain" },
  { type: "frustrated", emoji: "😤", label: "frustrated" },
];

export function MoodPicker({ value, onChange }: MoodPickerProps) {
  return (
    <div className="flex items-center gap-1">
      {MOODS.map(({ type, emoji, label }) => (
        <button
          key={type}
          onClick={() => onChange(type)}
          className={`w-8 h-8 flex items-center justify-center rounded-full text-base transition-all ${
            value === type
              ? "bg-white/15 scale-110"
              : "hover:bg-white/5 opacity-60 hover:opacity-100"
          }`}
          aria-label={label}
          aria-pressed={value === type}
          title={label}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
