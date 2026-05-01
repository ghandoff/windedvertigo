"use client";

/**
 * RoomExplorer — the "find" phase reimagined as spatial exploration.
 *
 * Instead of filtering a database, kids explore familiar places
 * and notice what's around them. The rooms are provocations —
 * invitations to look at ordinary spaces with fresh eyes.
 *
 * "creative but not frivolous, lighthearted but not careless,
 *  curious but not aimless." — winded.vertigo verbal identity
 *
 * The flow: pick a room → tap what you notice → visit more rooms
 * → see what these can become. Context tags are auto-inferred from
 * which rooms the kid visits, so the matcher results are spatially
 * relevant without the kid ever thinking about "filters."
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Material, MatcherResult } from "./types";
import { ROOMS, RoomConfig } from "./room-config";
import { RoomGrid } from "./room-grid";
import { RoomScene } from "./room-scene";
import { FloatingBasket } from "./floating-basket";
import { MatcherResults } from "./matcher-results";
import { apiUrl } from "@/lib/api-url";

interface RoomExplorerProps {
  materials: Material[];
  slots: string[];
  contexts: string[];
  /**
   * Material IDs to seed the selection with on mount. Used when the user
   * arrives from the landing MaterialPickerHero, which ships a preselected
   * list via ?materials=<csv>. Applied once on mount — later prop changes
   * won't overwrite user edits.
   */
  preselectedMaterialIds?: string[];
}

export default function RoomExplorer({
  materials,
  slots,
  contexts,
  preselectedMaterialIds,
}: RoomExplorerProps) {
  /* ── view state ─────────────────────────────────────────────── */
  const [view, setView] = useState<"rooms" | "scene">("rooms");
  const [activeRoom, setActiveRoom] = useState<RoomConfig | null>(null);
  const [visitedRooms, setVisitedRooms] = useState<Set<string>>(new Set());

  /* ── selection state ────────────────────────────────────────── */
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());

  /* Seed selectedMaterials once on mount when the URL brings along a
     preselected list (?materials=csv → FindPhaseShell → here). Using a
     ref so prop changes after mount don't clobber user edits. */
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (!preselectedMaterialIds || preselectedMaterialIds.length === 0) return;
    seededRef.current = true;
    setSelectedMaterials(new Set(preselectedMaterialIds));
  }, [preselectedMaterialIds]);

  /* ── submission state ───────────────────────────────────────── */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MatcherResult | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  /* ── derived data ───────────────────────────────────────────── */

  /**
   * Show all rooms always — rooms are a UX concept (spatial grouping),
   * not a data filter. Context filtering happens at API submission time.
   * Previously filtered by DB contexts, which left only 1 room visible
   * when the DB had limited context_tags.
   */
  const availableRooms = ROOMS;

  /** slug → Material index for O(1) lookups in RoomScene */
  const slugIndex = useMemo(() => {
    const map = new Map<string, Material>();
    for (const mat of materials) {
      map.set(mat.title.toLowerCase().trim(), mat);
    }
    return map;
  }, [materials]);

  /** title map for FloatingBasket emoji display */
  const materialTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const mat of materials) map.set(mat.id, mat.title);
    return map;
  }, [materials]);

  const materialFormMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const mat of materials) map.set(mat.id, mat.form_primary);
    return map;
  }, [materials]);

  const materialEmojiMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const mat of materials) map.set(mat.id, mat.emoji ?? null);
    return map;
  }, [materials]);

  const materialIconMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const mat of materials) map.set(mat.id, mat.icon ?? null);
    return map;
  }, [materials]);

  /** count of selected materials per room (for badge display) */
  const selectedCountByRoom = useMemo(() => {
    const counts = new Map<string, number>();
    for (const room of ROOMS) {
      let count = 0;
      const seen = new Set<string>();
      for (const slug of room.materialSlugs) {
        const mat = slugIndex.get(slug);
        if (mat && selectedMaterials.has(mat.id) && !seen.has(mat.id)) {
          count++;
          seen.add(mat.id);
        }
      }
      // count slots too
      for (const slot of room.slotSlugs) {
        if (selectedSlots.has(slot)) count++;
      }
      if (count > 0) counts.set(room.id, count);
    }
    return counts;
  }, [slugIndex, selectedMaterials, selectedSlots]);

  /* ── actions ────────────────────────────────────────────────── */

  const toggleMaterial = useCallback((id: string) => {
    setSelectedMaterials((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSlot = useCallback((slot: string) => {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  }, []);

  const enterRoom = useCallback((room: RoomConfig) => {
    setActiveRoom(room);
    setView("scene");
    setVisitedRooms((prev) => new Set(prev).add(room.id));
  }, []);

  const exitRoom = useCallback(() => {
    setView("rooms");
    setActiveRoom(null);
  }, []);

  const handleClear = useCallback(() => {
    setSelectedMaterials(new Set());
    setSelectedSlots(new Set());
    setVisitedRooms(new Set());
    setResults(null);
    setError(null);
  }, []);

  /**
   * Submit to matcher API with auto-inferred contexts.
   *
   * Context inference: each visited room contributes its contextTag
   * to the API call. The kid never thinks about "contexts" — the
   * rooms they explored ARE the context.
   */
  const handleSubmit = useCallback(async () => {
    if (selectedMaterials.size + selectedSlots.size === 0) return;
    setLoading(true);
    setError(null);

    // infer contexts from visited rooms
    const inferredContexts: string[] = [];
    for (const roomId of visitedRooms) {
      const room = ROOMS.find((r) => r.id === roomId);
      if (room?.contextTag) inferredContexts.push(room.contextTag);
    }

    try {
      const res = await fetch(apiUrl("/api/matcher"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materials: Array.from(selectedMaterials),
          forms: [],
          slots: Array.from(selectedSlots),
          contexts: [...new Set(inferredContexts)], // deduplicate
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `request failed (${res.status})`);
      }

      const data: MatcherResult = await res.json();
      setResults(data);

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      setError(err.message || "something went wrong");
    } finally {
      setLoading(false);
    }
  }, [selectedMaterials, selectedSlots, visitedRooms, resultsRef]);

  /* ── render ─────────────────────────────────────────────────── */
  const totalSelected = selectedMaterials.size + selectedSlots.size;

  return (
    <div>
      {view === "rooms" && (
        <RoomGrid
          rooms={availableRooms}
          visitedRooms={visitedRooms}
          selectedCountByRoom={selectedCountByRoom}
          onRoomTap={enterRoom}
        />
      )}

      {view === "scene" && activeRoom && (
        <RoomScene
          room={activeRoom}
          materials={materials}
          slugIndex={slugIndex}
          selectedMaterials={selectedMaterials}
          selectedSlots={selectedSlots}
          onMaterialTap={toggleMaterial}
          onSlotTap={toggleSlot}
          onBack={exitRoom}
        />
      )}

      {/* error display */}
      {error && (
        <p
          className="text-sm mt-3"
          style={{ color: "var(--wv-redwood)" }}
        >
          {error}
        </p>
      )}

      {/* spacer for mobile floating basket */}
      {totalSelected > 0 && <div className="h-24 sm:h-0" />}

      {/* floating basket — discovery bag */}
      <FloatingBasket
        selectedMaterials={selectedMaterials}
        selectedSlots={selectedSlots}
        materialTitleMap={materialTitleMap}
        materialFormMap={materialFormMap}
        materialEmojiMap={materialEmojiMap}
        materialIconMap={materialIconMap}
        loading={loading}
        onSubmit={handleSubmit}
        onClear={handleClear}
      />

      {/* results */}
      <MatcherResults
        results={results}
        loading={loading}
        resultsRef={resultsRef as React.RefObject<HTMLDivElement>}
        selectedMaterialsSize={selectedMaterials.size}
      />
    </div>
  );
}
