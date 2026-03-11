"use client";

import { useState, useMemo } from "react";
import VaultCard, { type VaultActivity } from "./VaultCard";

interface VaultGridProps {
  activities: VaultActivity[];
  viewerTier: string;
}

function unique(arr: string[][]): string[] {
  return [...new Set(arr.flat())].sort();
}

export default function VaultGrid({ activities, viewerTier }: VaultGridProps) {
  const [formatFilter, setFormatFilter] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [ageFilter, setAgeFilter] = useState<string>("");

  /* derive filter options from data */
  const allFormats = useMemo(() => unique(activities.map((a) => a.format)), [activities]);
  const allTypes = useMemo(() => unique(activities.map((a) => a.type)), [activities]);
  const allAges = useMemo(
    () => [...new Set(activities.map((a) => a.age_range).filter(Boolean) as string[])].sort(),
    [activities],
  );

  /* apply filters */
  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (formatFilter.size > 0 && !a.format.some((f) => formatFilter.has(f))) return false;
      if (typeFilter.size > 0 && !a.type.some((t) => typeFilter.has(t))) return false;
      if (ageFilter && a.age_range !== ageFilter) return false;
      return true;
    });
  }, [activities, formatFilter, typeFilter, ageFilter]);

  function toggleSet(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  const hasFilters = formatFilter.size > 0 || typeFilter.size > 0 || ageFilter !== "";

  return (
    <div>
      {/* filter bar */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* format multi-select */}
        <FilterGroup
          label="Format"
          options={allFormats}
          selected={formatFilter}
          onToggle={(v) => setFormatFilter((s) => toggleSet(s, v))}
        />

        {/* type multi-select */}
        <FilterGroup
          label="Type"
          options={allTypes}
          selected={typeFilter}
          onToggle={(v) => setTypeFilter((s) => toggleSet(s, v))}
        />

        {/* age range select */}
        {allAges.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-cadet/50">Age</span>
            <select
              value={ageFilter}
              onChange={(e) => setAgeFilter(e.target.value)}
              className="text-xs rounded-md border border-cadet/15 bg-white px-2 py-1 text-cadet/70 focus:outline-none focus:ring-1 focus:ring-sienna/30"
            >
              <option value="">All</option>
              {allAges.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        )}

        {hasFilters && (
          <button
            onClick={() => { setFormatFilter(new Set()); setTypeFilter(new Set()); setAgeFilter(""); }}
            className="text-xs text-redwood/70 hover:text-redwood underline underline-offset-2"
          >
            clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-cadet/40">
          {filtered.length} activit{filtered.length === 1 ? "y" : "ies"}
        </span>
      </div>

      {/* grid */}
      {filtered.length === 0 ? (
        <p className="text-center text-sm text-cadet/40 py-16">
          No activities match your filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((a) => (
            <VaultCard key={a.id} activity={a} viewerTier={viewerTier} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── pill-based multi-select filter ── */
function FilterGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs font-medium text-cadet/50">{label}</span>
      {options.map((opt) => {
        const active = selected.has(opt);
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className={`text-2xs rounded-full px-2.5 py-0.5 border transition-colors ${
              active
                ? "border-sienna/50 bg-sienna/10 text-sienna font-semibold"
                : "border-cadet/10 bg-white text-cadet/50 hover:border-cadet/25"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
