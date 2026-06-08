"use client";

/**
 * FacetMultiSelect — a compact popover multi-select for the bibliography facets
 * (topics, journals, source types, used-in). Shows a trigger with the active
 * count; the popover lists values with counts + checkboxes and a quick filter.
 *
 * Controlled: parent owns the selected[] and the option list (value + count).
 */

import { useMemo, useState } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export interface FacetOption {
  value: string;
  count: number;
}

export function FacetMultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FacetOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();

  const shown = useMemo(
    () => (ql ? options.filter((o) => o.value.toLowerCase().includes(ql)) : options),
    [options, ql],
  );

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const active = selected.length > 0;

  return (
    <Popover>
      <PopoverTrigger
        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs transition-colors ${
          active
            ? "border-primary/60 bg-primary/5 text-foreground"
            : "border-border text-muted-foreground hover:border-primary/40"
        }`}
      >
        {label}
        {active && (
          <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] tabular-nums">
            {selected.length}
          </span>
        )}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="p-2 border-b border-border">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`filter ${label}…`}
            className="h-7 text-xs"
            autoFocus
          />
        </div>
        {active && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/50 border-b border-border"
          >
            <X className="h-3 w-3" /> clear {selected.length} selected
          </button>
        )}
        <div className="max-h-60 overflow-y-auto py-1">
          {shown.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-muted-foreground">no matches</p>
          )}
          {shown.map((o) => {
            const on = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/50 text-left"
              >
                <span
                  className={`flex items-center justify-center h-3.5 w-3.5 rounded border shrink-0 ${
                    on ? "bg-primary border-primary text-primary-foreground" : "border-input"
                  }`}
                >
                  {on && <Check className="h-2.5 w-2.5" />}
                </span>
                <span className="flex-1 truncate">{o.value}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{o.count}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
