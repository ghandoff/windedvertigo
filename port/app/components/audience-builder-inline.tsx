"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AudienceFilter } from "@/lib/notion/types";

interface AudienceBuilderInlineProps {
  value: AudienceFilter;
  onChange: (filters: AudienceFilter) => void;
}

/**
 * 4 primary audience filters (simplified from 9).
 * Legacy keys (priority, friendship, outreachStatus, connection) are still
 * accepted in persisted campaign JSON but not shown in the builder UI.
 */
const FILTER_CONFIG: {
  key: keyof AudienceFilter;
  label: string;
  options: string[];
}[] = [
  { key: "fitRating", label: "fit", options: ["🔥 Perfect fit", "✅ Strong fit", "🟡 Moderate fit"] },
  { key: "relationship", label: "relationship", options: [
    "stranger", "aware", "contacted", "in conversation", "collaborating", "active partner", "champion",
  ]},
  { key: "source", label: "source", options: ["cold research", "conference", "direct network", "partner referral", "rfp platform", "internal"] },
  { key: "marketSegment", label: "segment", options: [
    "Higher Education / Business Schools", "Corporate L&D / Social Impact",
    "Foundations Running Grantee Programmes", "International Development / NGOs",
    "EdTech Product Companies", "EdTech Pre-Launch / Seeking Evidence",
    "Museum & Exhibit Design", "Toy & Game Companies",
    "Social Impact Product Organisations", "Youth Development / Play",
    "Government Education Innovation", "UN Agencies & Multilaterals",
    "Foundations (Evidence for Impact)", "EdTech VCs & Investment Firms",
    "Conference / Event Organisers", "Academic Research Centres",
    "Play Advocacy / Networks", "Arts & Culture Education",
    "Health / Wellbeing Education", "Environmental / Climate Education",
  ]},
];

function getSelectedValues(value: AudienceFilter, key: keyof AudienceFilter): string[] {
  const v = value[key];
  if (!v) return [];
  return Array.isArray(v) ? v : [v as string];
}

interface MultiSelectFilterProps {
  label: string;
  filterKey: keyof AudienceFilter;
  options: string[];
  value: AudienceFilter;
  onChange: (filters: AudienceFilter) => void;
}

function MultiSelectFilter({ label, filterKey, options, value, onChange }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const selected = getSelectedValues(value, filterKey);

  function toggle(opt: string) {
    const next = { ...value };
    const current = getSelectedValues(value, filterKey);
    const updated = current.includes(opt)
      ? current.filter((v) => v !== opt)
      : [...current, opt];

    if (updated.length === 0) {
      delete next[filterKey];
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next as any)[filterKey] = updated.length === 1 ? updated[0] : updated;
    }
    onChange(next);
  }

  function selectAll() {
    const next = { ...value };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (next as any)[filterKey] = options.length === 1 ? options[0] : [...options];
    onChange(next);
  }

  function clearAll() {
    const next = { ...value };
    delete next[filterKey];
    onChange(next);
  }

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between h-8 px-2.5 rounded-lg border text-xs transition-colors ${
          selected.length > 0
            ? "border-accent bg-accent/5 text-accent"
            : "border-border text-muted-foreground hover:border-accent/50"
        }`}
      >
        <span className="truncate">
          {selected.length === 0
            ? `all ${label}`
            : selected.length === 1
              ? selected[0]
              : `${selected.length} ${label}`}
        </span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-20 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-52 overflow-y-auto">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b sticky top-0 bg-popover">
            <button onClick={selectAll} className="text-[10px] text-accent hover:underline">select all</button>
            <button onClick={clearAll} className="text-[10px] text-muted-foreground hover:underline">clear</button>
          </div>
          {options.map((opt) => {
            const isSelected = selected.includes(opt);
            return (
              <label
                key={opt}
                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-muted cursor-pointer text-xs"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(opt)}
                  className="accent-accent h-3.5 w-3.5"
                />
                <span className="truncate">{opt}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AudienceBuilderInline({ value, onChange }: AudienceBuilderInlineProps) {
  const activeCount = Object.keys(value).filter((k) => {
    const v = value[k as keyof AudienceFilter];
    return v && (Array.isArray(v) ? v.length > 0 : true);
  }).length;

  // Count total selected values across all filters
  const totalSelections = FILTER_CONFIG.reduce((sum, f) => {
    return sum + getSelectedValues(value, f.key).length;
  }, 0);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        select filters to target specific organizations. multi-select within each filter.{" "}
        {activeCount > 0 && (
          <span className="font-medium text-foreground">
            {activeCount} filter{activeCount > 1 ? "s" : ""} active ({totalSelections} values)
          </span>
        )}
      </p>

      {/* Active filter badges */}
      {totalSelections > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {FILTER_CONFIG.map((f) => {
            const selected = getSelectedValues(value, f.key);
            return selected.map((v) => (
              <Badge
                key={`${f.key}-${v}`}
                variant="secondary"
                className="text-[10px] gap-1 pr-1 cursor-pointer"
                onClick={() => {
                  const next = { ...value };
                  const current = getSelectedValues(value, f.key);
                  const updated = current.filter((x) => x !== v);
                  if (updated.length === 0) {
                    delete next[f.key];
                  } else {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (next as any)[f.key] = updated.length === 1 ? updated[0] : updated;
                  }
                  onChange(next);
                }}
              >
                {v}
                <X className="h-2.5 w-2.5" />
              </Badge>
            ));
          })}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {FILTER_CONFIG.map((f) => (
          <MultiSelectFilter
            key={f.key}
            label={f.label}
            filterKey={f.key}
            options={f.options}
            value={value}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}
