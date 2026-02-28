"use client";

import { useState, useMemo } from "react";
import type { VaultActivity } from "@/lib/types";
import VaultCard from "./vault-card";
import VaultDetailModal from "./vault-detail-modal";
import VaultFilterBar from "./vault-filter-bar";

interface VaultGalleryProps {
  activities: VaultActivity[];
}

export default function VaultGallery({ activities }: VaultGalleryProps) {
  const [activeType, setActiveType] = useState<string | null>(null);
  const [activeDuration, setActiveDuration] = useState<string | null>(null);
  const [selected, setSelected] = useState<VaultActivity | null>(null);

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
    return Array.from(set).sort();
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
      <VaultFilterBar
        types={types}
        durations={durations}
        activeType={activeType}
        activeDuration={activeDuration}
        onTypeChange={setActiveType}
        onDurationChange={setActiveDuration}
      />

      {/* result count */}
      <p className="text-xs opacity-30 mb-4">
        {filtered.length} {filtered.length === 1 ? "activity" : "activities"}
      </p>

      {/* grid */}
      <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
        {filtered.map((a) => (
          <VaultCard key={a.id} activity={a} onClick={() => setSelected(a)} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 opacity-40">
          <p>no activities match the current filters.</p>
        </div>
      )}

      {/* detail modal */}
      <VaultDetailModal
        activity={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
