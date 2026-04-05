"use client";

/**
 * tidal.pool sandbox — the main interactive experience.
 * Blank pool with full palette access. No auth required.
 * Includes mirror.log reflection prompt after pausing simulation.
 */

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSimulation } from "@/hooks/use-simulation";
import { PoolCanvas } from "@/components/pool-canvas";
import { ElementPalette } from "@/components/element-palette";
import { SimulationControls } from "@/components/simulation-controls";
import { ElementInspector } from "@/components/element-inspector";
import { ReflectionPrompt } from "@windedvertigo/mirror-log";
import { DEFAULT_PALETTE } from "@/lib/palette-data";
import type { PaletteItem } from "@/lib/types";

export default function SandboxPage() {
  const { state, dispatch, addElementFromPalette, addConnection } =
    useSimulation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, setDraggedItem] = useState<PaletteItem | null>(null);
  const [showReflection, setShowReflection] = useState(false);
  const [hasReflected, setHasReflected] = useState(false);
  const nextTapPos = useRef(0);

  const selectedElement = state.elements.find((e) => e.id === selectedId) ?? null;

  // Show reflection prompt after meaningful interaction (10+ ticks, then pause)
  const shouldOfferReflection =
    !state.playing &&
    state.tick >= 10 &&
    state.elements.length >= 2 &&
    !hasReflected;

  const handleReflectionComplete = useCallback(() => {
    setShowReflection(false);
    setHasReflected(true);
  }, []);

  // Mobile: tap-to-add places elements in a staggered grid pattern
  const handleTapAdd = useCallback(
    (item: PaletteItem) => {
      const positions = [
        { x: 150, y: 150 },
        { x: 280, y: 120 },
        { x: 200, y: 260 },
        { x: 330, y: 230 },
        { x: 120, y: 340 },
        { x: 260, y: 350 },
        { x: 170, y: 200 },
        { x: 310, y: 300 },
      ];
      const pos = positions[nextTapPos.current % positions.length]!;
      // Add jitter so repeated adds don't stack exactly
      const jitterX = (Math.random() - 0.5) * 40;
      const jitterY = (Math.random() - 0.5) * 40;
      const id = addElementFromPalette(item, pos.x + jitterX, pos.y + jitterY);
      setSelectedId(id);
      nextTapPos.current++;
    },
    [addElementFromPalette],
  );

  return (
    <div className="h-[100dvh] flex flex-col">
      {/* Header */}
      <header className="wv-header shrink-0">
        <Link href="/harbour/tidal-pool" className="wv-header-brand">
          ← tidal.pool
        </Link>
        <span className="text-xs text-[var(--color-text-on-dark-muted)]">
          sandbox
        </span>
      </header>

      {/* Controls */}
      <div className="shrink-0 px-3 lg:px-4 pt-2 lg:pt-3">
        <SimulationControls
          playing={state.playing}
          speed={state.speed}
          tick={state.tick}
          elementCount={state.elements.length}
          connectionCount={state.connections.length}
          dispatch={dispatch}
        />
      </div>

      {/* Main area: palette + canvas + inspector */}
      {/* pb-20 on mobile to clear the fixed bottom palette sheet */}
      <div className="flex-1 flex min-h-0 px-3 lg:px-4 py-2 lg:py-3 gap-3 pb-24 lg:pb-3">
        {/* Palette (desktop sidebar + mobile bottom sheet) */}
        <ElementPalette
          items={DEFAULT_PALETTE}
          onDragStart={setDraggedItem}
          onTapAdd={handleTapAdd}
        />

        {/* Canvas */}
        <PoolCanvas
          elements={state.elements}
          connections={state.connections}
          tick={state.tick}
          dispatch={dispatch}
          selectedElementId={selectedId}
          onSelectElement={setSelectedId}
          paletteItems={DEFAULT_PALETTE}
          addElementFromPalette={addElementFromPalette}
          addConnection={addConnection}
        />

        {/* Inspector (conditional, desktop only) */}
        {selectedElement && (
          <div className="hidden lg:block">
            <ElementInspector
              element={selectedElement}
              connections={state.connections}
              allElements={state.elements}
              dispatch={dispatch}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}
      </div>

      {/* Reflection prompt trigger */}
      {shouldOfferReflection && !showReflection && (
        <div className="shrink-0 px-4 pb-3">
          <button
            onClick={() => setShowReflection(true)}
            className="w-full py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-[var(--color-text-on-dark-muted)] hover:text-[var(--color-text-on-dark)] hover:bg-white/10 transition-all"
          >
            pause and reflect — what did you notice?
          </button>
        </div>
      )}

      {/* mirror.log reflection panel */}
      {showReflection && (
        <div className="shrink-0 px-4 pb-4">
          <ReflectionPrompt
            sourceApp="tidal-pool"
            skillsExercised={["systems-thinking", "cause-and-effect"]}
            sessionSummary={`sandbox session — ${state.elements.length} elements, ${state.connections.length} connections, ${state.tick} ticks`}
            onComplete={handleReflectionComplete}
            onSkip={() => {
              setShowReflection(false);
              setHasReflected(true);
            }}
          />
        </div>
      )}
    </div>
  );
}
