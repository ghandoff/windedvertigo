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
      <div className="flex flex-wrap items-center gap-2 mb-4" role="toolbar" aria-label="Filter activities">
        {/* type filters */}
        <button
          onClick={() => setActiveType(null)}
          aria-pressed={activeType === null}
          className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
          style={{
            backgroundColor: activeType === null ? "var(--vault-accent)" : "rgba(175,79,65,0.1)",
            color: activeType === null ? "#fff" : "rgba(175,79,65,0.7)",
          }}
        >
          all types
        </button>
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setActiveType(activeType === t ? null : t)}
            aria-pressed={activeType === t}
            className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
            style={{
              backgroundColor: activeType === t ? "var(--vault-accent)" : "rgba(175,79,65,0.1)",
              color: activeType === t ? "#fff" : "rgba(175,79,65,0.7)",
            }}
          >
            {t.toLowerCase()}
          </button>
        ))}

        {/* duration separator */}
        {durations.length > 0 && (
          <span style={{ color: "rgba(255,255,255,0.15)" }} className="mx-1">|</span>
        )}

        {/* duration filters */}
        {durations.map((d) => (
          <button
            key={d}
            onClick={() => setActiveDuration(activeDuration === d ? null : d)}
            aria-pressed={activeDuration === d}
            className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
            style={{
              backgroundColor: activeDuration === d ? "#6b8e6b" : "rgba(107,142,107,0.1)",
              color: activeDuration === d ? "#fff" : "rgba(107,142,107,0.7)",
            }}
          >
            {d}
          </button>
        ))}
      </div>

      {/* result count */}
      <p
        className="text-xs mb-5"
        style={{ color: "var(--vault-text-muted)" }}
        aria-live="polite"
      >
        {filtered.length} {filtered.length === 1 ? "activity" : "activities"}
      </p>

      {/* grid */}
      <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
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
          <p className="text-sm" style={{ color: "var(--vault-text-muted)" }}>
            no activities match the current filters.
          </p>
        </div>
      )}
    </>
  );
}
