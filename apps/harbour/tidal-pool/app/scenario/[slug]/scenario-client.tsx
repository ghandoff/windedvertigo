"use client";

/**
 * Scenario client — interactive simulation pre-loaded with
 * elements and connections from a Notion scenario.
 *
 * Layout mirrors sandbox/page.tsx:
 *   Desktop (≥ 640px): palette sidebar | canvas | inspector sidebar
 *   Mobile  (< 640px): canvas fills height → palette strip at bottom
 */

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useSimulation } from "@/hooks/use-simulation";
import { PoolCanvas } from "@/components/pool-canvas";
import { ElementPalette } from "@/components/element-palette";
import { SimulationControls } from "@/components/simulation-controls";
import { ElementInspector } from "@/components/element-inspector";
import { ReflectionPrompt } from "@windedvertigo/mirror-log";
import type { Scenario, PaletteItem } from "@/lib/types";

export function ScenarioClient({
  scenario,
  palette,
}: {
  scenario: Scenario;
  palette: PaletteItem[];
}) {
  const { state, dispatch, addElementFromPalette, addConnection } =
    useSimulation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, setDraggedItem] = useState<PaletteItem | null>(null);
  const [showReflection, setShowReflection] = useState(false);
  const [hasReflected, setHasReflected] = useState(false);
  const hasFitted = useRef(false);

  // Load scenario on mount
  useEffect(() => {
    dispatch({ type: "LOAD_SCENARIO", scenario });
    hasFitted.current = false;
  }, [dispatch, scenario]);

  // After scenario loads + canvas renders, fit elements to actual canvas size
  useEffect(() => {
    if (hasFitted.current || state.elements.length === 0) return;
    const canvases = document.querySelectorAll("canvas");
    const canvas = Array.from(canvases).find((c) => c.offsetWidth > 0);
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      dispatch({ type: "FIT_TO_CANVAS", width: rect.width, height: rect.height });
      hasFitted.current = true;
    }
  }, [state.elements.length, dispatch]);

  const selectedElement =
    state.elements.find((e) => e.id === selectedId) ?? null;

  const shouldOfferReflection =
    !state.playing &&
    state.tick >= 10 &&
    state.elements.length >= 2 &&
    !hasReflected;

  const handleReflectionComplete = useCallback(() => {
    setShowReflection(false);
    setHasReflected(true);
  }, []);

  /** Mobile tap-to-add: place element at canvas centre with small random offset */
  const handleTapAdd = useCallback(
    (item: PaletteItem) => {
      // Find the visible canvas (skip the hidden desktop one)
      const canvases = document.querySelectorAll("canvas");
      const canvas = Array.from(canvases).find((c) => c.offsetWidth > 0);
      const rect = canvas?.getBoundingClientRect();
      const cx = rect ? rect.width / 2 : 200;
      const cy = rect ? rect.height / 2 : 200;
      const offsetX = (Math.random() - 0.5) * 80;
      const offsetY = (Math.random() - 0.5) * 80;
      const id = addElementFromPalette(item, cx + offsetX, cy + offsetY);
      setSelectedId(id);
    },
    [addElementFromPalette],
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="wv-header shrink-0">
        <Link href="/" className="wv-header-brand">
          ← tidal.pool
        </Link>
        <span className="text-xs text-[var(--color-text-on-dark-muted)]">
          {scenario.name}
        </span>
      </header>

      {/* Challenge prompt */}
      {scenario.challengePrompt && (
        <div className="shrink-0 px-3 sm:px-4 pt-3">
          <div className="p-3 rounded-xl border border-white/10 bg-white/5 text-sm">
            <span className="text-[var(--wv-sienna)] font-semibold text-xs uppercase tracking-wider mr-2">
              challenge
            </span>
            <span className="text-[var(--color-text-on-dark-muted)]">
              {scenario.challengePrompt}
            </span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="shrink-0 px-3 sm:px-4 pt-2 sm:pt-3">
        <SimulationControls
          playing={state.playing}
          speed={state.speed}
          tick={state.tick}
          elementCount={state.elements.length}
          connectionCount={state.connections.length}
          dispatch={dispatch}
        />
      </div>

      {/* ── Desktop layout: palette | canvas | inspector ── */}
      <div className="hidden sm:flex flex-1 min-h-0 px-4 py-3 gap-3">
        <ElementPalette items={palette} onDragStart={setDraggedItem} />
        <PoolCanvas
          elements={state.elements}
          connections={state.connections}
          tick={state.tick}
          dispatch={dispatch}
          selectedElementId={selectedId}
          onSelectElement={setSelectedId}
          paletteItems={palette}
          addElementFromPalette={addElementFromPalette}
          addConnection={addConnection}
        />
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

      {/* ── Mobile layout: canvas → palette strip at bottom ── */}
      <div className="flex sm:hidden flex-col flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-h-0 px-3 py-2">
          <PoolCanvas
            elements={state.elements}
            connections={state.connections}
            tick={state.tick}
            dispatch={dispatch}
            selectedElementId={selectedId}
            onSelectElement={setSelectedId}
            paletteItems={palette}
            addElementFromPalette={addElementFromPalette}
            addConnection={addConnection}
          />
        </div>

        <div className="shrink-0 px-3 pb-2">
          <ElementPalette
            items={palette}
            onDragStart={setDraggedItem}
            onTapAdd={handleTapAdd}
          />
        </div>

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

      {/* Reflection prompt trigger */}
      {shouldOfferReflection && !showReflection && (
        <div className="shrink-0 px-3 sm:px-4 pb-3">
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
        <div className="shrink-0 px-3 sm:px-4 pb-4">
          <ReflectionPrompt
            sourceApp="tidal-pool"
            skillsExercised={scenario.skillSlugs}
            sessionSummary={`${scenario.name} — ${state.elements.length} elements, ${state.connections.length} connections, ${state.tick} ticks`}
            onComplete={handleReflectionComplete}
            onSkip={() => {
              setShowReflection(false);
              setHasReflected(true);
            }}
          />
        </div>
      )}

      {/* Skill tags footer */}
      {scenario.skillSlugs.length > 0 && (
        <div className="shrink-0 px-3 sm:px-4 pb-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-[var(--color-text-on-dark-muted)] uppercase tracking-wider">
            skills:
          </span>
          {scenario.skillSlugs.map((skill) => (
            <span
              key={skill}
              className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-[var(--color-text-on-dark-muted)]"
            >
              {skill.replace(/-/g, " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
