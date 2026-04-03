"use client";

/**
 * tidal.pool sandbox — the main interactive experience.
 * Blank pool with full palette access. No auth required.
 */

import { useState } from "react";
import Link from "next/link";
import { useSimulation } from "@/hooks/use-simulation";
import { PoolCanvas } from "@/components/pool-canvas";
import { ElementPalette } from "@/components/element-palette";
import { SimulationControls } from "@/components/simulation-controls";
import { ElementInspector } from "@/components/element-inspector";
import { DEFAULT_PALETTE } from "@/lib/palette-data";
import type { PaletteItem } from "@/lib/types";

export default function SandboxPage() {
  const { state, dispatch, addElementFromPalette, addConnection } =
    useSimulation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, setDraggedItem] = useState<PaletteItem | null>(null);

  const selectedElement = state.elements.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="h-screen flex flex-col">
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
      <div className="shrink-0 px-4 pt-3">
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
      <div className="flex-1 flex min-h-0 px-4 py-3 gap-3">
        {/* Palette */}
        <ElementPalette
          items={DEFAULT_PALETTE}
          onDragStart={setDraggedItem}
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

        {/* Inspector (conditional) */}
        {selectedElement && (
          <ElementInspector
            element={selectedElement}
            connections={state.connections}
            allElements={state.elements}
            dispatch={dispatch}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}
