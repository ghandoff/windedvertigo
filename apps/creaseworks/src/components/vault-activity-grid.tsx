"use client";

import { useState, useMemo } from "react";
import { VaultActivityCard } from "@/components/ui/vault-activity-card";
import type { VaultActivity } from "@/components/ui/vault-activity-card";

interface VaultActivityGridProps {
  activities: VaultActivity[];
  isEntitled: boolean;
}

export default function VaultActivityGrid({
  activities,
  isEntitled,
}: VaultActivityGridProps) {
  const [activeType, setActiveType] = useState<string | null>(null);
  const [activeDuration, setActiveDuration] = useState<string | null>(null);

  // Derive unique filter options from data
  const types = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((a) => a.type.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [activities]);

  const durations = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((a) => {
      if (a.duration) set.add(a.duration);
    });
    return Array.from(set).sort((a, b) => parseInt(a) - parseInt(b));
  }, [activities]);

  // Apply filters
  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (activeType && !a.type.includes(activeType)) return false;
      if (activeDuration && a.duration !== activeDuration) return false;
      return true;
    });
  }, [activities, activeType, activeDuration]);

  return (
    <>
      {/* filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* type filters */}
        <button
          onClick={() => setActiveType(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            activeType === null
              ? "bg-cadet text-white"
              : "bg-cadet/8 text-cadet/60 hover:bg-cadet/15"
          }`}
        >
          all types
        </button>
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setActiveType(activeType === t ? null : t)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeType === t
                ? "bg-cadet text-white"
                : "bg-cadet/8 text-cadet/60 hover:bg-cadet/15"
            }`}
          >
            {t.toLowerCase()}
          </button>
        ))}

        {/* duration separator */}
        {durations.length > 0 && (
          <span className="text-cadet/20 mx-1">|</span>
        )}

        {/* duration filters */}
        {durations.map((d) => (
          <button
            key={d}
            onClick={() => setActiveDuration(activeDuration === d ? null : d)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeDuration === d
                ? "bg-sienna text-white"
                : "bg-sienna/8 text-sienna/60 hover:bg-sienna/15"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* result count */}
      <p className="text-xs text-cadet/30 mb-5" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? "activity" : "activities"}
      </p>

      {/* grid */}
      <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(300px,1fr))] wv-stagger">
        {filtered.map((a) => (
          <VaultActivityCard
            key={a.id}
            activity={a}
            isEntitled={isEntitled}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="text-3xl mb-3" aria-hidden>🎭</p>
          <p className="text-cadet/50 text-sm">
            no activities match the current filters.
          </p>
        </div>
      )}
    </>
  );
}
