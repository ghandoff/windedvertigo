"use client";

import { TrendingDown } from "lucide-react";

interface ThinLine {
  domain: string;
  count: number;
}

interface ThinSpotWorklistProps {
  lines: ThinLine[];
  onSelect: (domain: string) => void;
}

export function ThinSpotWorklist({ lines, onSelect }: ThinSpotWorklistProps) {
  if (lines.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
        <span className="text-xs font-medium text-amber-700">
          {lines.length} domain{lines.length !== 1 ? "s" : ""} need more depth
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {lines.map((l) => (
          <button
            key={l.domain}
            onClick={() => onSelect(l.domain)}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-700 hover:bg-amber-500/20 transition-colors"
          >
            {l.domain}
            <span className="opacity-60 tabular-nums">{l.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
