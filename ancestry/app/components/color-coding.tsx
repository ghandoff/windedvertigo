"use client";

import type { ColorMode } from "@/lib/types";

const COLOR_MODES: { value: ColorMode; label: string }[] = [
  { value: "sex", label: "sex" },
  { value: "generation", label: "generation" },
  { value: "surname", label: "surname" },
  { value: "living", label: "living" },
  { value: "completeness", label: "completeness" },
];

const SURNAME_PALETTE = [
  "hsl(0, 55%, 75%)", "hsl(30, 55%, 75%)", "hsl(60, 55%, 75%)",
  "hsl(90, 55%, 75%)", "hsl(120, 55%, 75%)", "hsl(150, 55%, 75%)",
  "hsl(180, 55%, 75%)", "hsl(210, 55%, 75%)", "hsl(240, 55%, 75%)",
  "hsl(270, 55%, 75%)", "hsl(300, 55%, 75%)", "hsl(330, 55%, 75%)",
];

type LegendEntry = { color: string; label: string };

function legendForMode(mode: ColorMode): LegendEntry[] {
  switch (mode) {
    case "sex":
      return [
        { color: "hsl(217, 91%, 90%)", label: "male" },
        { color: "hsl(350, 80%, 93%)", label: "female" },
        { color: "hsl(270, 60%, 90%)", label: "other" },
        { color: "hsl(0, 0%, 93%)", label: "unknown" },
      ];
    case "generation":
      return Array.from({ length: 5 }, (_, i) => ({
        color: `hsl(${i * 40}, 55%, 75%)`,
        label: i === 0 ? "self" : `gen ${i}`,
      }));
    case "surname":
      return [
        { color: SURNAME_PALETTE[0], label: "surname a" },
        { color: SURNAME_PALETTE[3], label: "surname b" },
        { color: SURNAME_PALETTE[6], label: "surname c" },
        { color: "hsl(0, 0%, 88%)", label: "unknown" },
      ];
    case "living":
      return [
        { color: "hsl(142, 40%, 85%)", label: "living" },
        { color: "hsl(0, 0%, 88%)", label: "deceased" },
      ];
    case "completeness":
      return [
        { color: "hsl(0, 60%, 85%)", label: "incomplete" },
        { color: "hsl(45, 70%, 85%)", label: "partial" },
        { color: "hsl(142, 50%, 85%)", label: "complete" },
      ];
    default: {
      // custom:fieldName — show generic legend with "has value" / "no value"
      if (mode.startsWith("custom:")) {
        const fieldName = mode.slice(7);
        return [
          { color: "hsl(210, 50%, 82%)", label: `has ${fieldName}` },
          { color: "hsl(0, 0%, 92%)", label: `no ${fieldName}` },
        ];
      }
      return [];
    }
  }
}

export function ColorCoding({
  value,
  onChange,
  customFieldKeys = [],
}: {
  value: ColorMode;
  onChange: (mode: ColorMode) => void;
  customFieldKeys?: string[];
}) {
  const legend = legendForMode(value);

  return (
    <div className="flex flex-col gap-2">
      {/* mode selector */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-card/90 backdrop-blur-sm border border-border p-1 shadow-sm">
        {COLOR_MODES.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
              value === opt.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {opt.label}
          </button>
        ))}

        {/* custom field options */}
        {customFieldKeys.length > 0 && (
          <>
            <span className="self-center text-[9px] text-muted-foreground/50 px-1">|</span>
            {customFieldKeys.map((key) => (
              <button
                key={`custom:${key}`}
                onClick={() => onChange(`custom:${key}`)}
                className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                  value === `custom:${key}`
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                by {key}
              </button>
            ))}
          </>
        )}
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-card/90 backdrop-blur-sm border border-border px-2 py-1.5 shadow-sm">
        {legend.map((entry) => (
          <div key={entry.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm border border-black/10"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-[10px] text-muted-foreground">{entry.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
