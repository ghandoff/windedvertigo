"use client";

/**
 * Main interactive canvas component.
 * Handles drag-and-drop from palette, element selection,
 * element dragging, and connection drawing.
 */

import { useState, useCallback, useEffect } from "react";
import { usePoolCanvas } from "@/hooks/use-pool-canvas";
import { hitTest, hitTestElement } from "@/lib/hit-test";
import type { PoolElement, Connection, ConnectionType, PaletteItem, PoolAction } from "@/lib/types";

interface PoolCanvasProps {
  elements: PoolElement[];
  connections: Connection[];
  tick: number;
  dispatch: React.Dispatch<PoolAction>;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  paletteItems: PaletteItem[];
  addElementFromPalette: (item: PaletteItem, x: number, y: number) => string;
  addConnection: (from: string, to: string, type: ConnectionType, strength?: number) => string;
}

export function PoolCanvas({
  elements,
  connections,
  tick,
  dispatch,
  selectedElementId,
  onSelectElement,
  paletteItems,
  addElementFromPalette,
  addConnection,
}: PoolCanvasProps) {
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState<ConnectionType>("amplifying");
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [draggingElement, setDraggingElement] = useState<string | null>(null);

  const { canvasRef, getCanvasPos } = usePoolCanvas({
    elements,
    connections,
    tick,
    selectedElementId,
    connectingFrom,
    mousePos: connectingFrom ? mousePos : null,
  });

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setConnectingFrom(null);
        onSelectElement(null);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedElementId) {
          dispatch({ type: "REMOVE_ELEMENT", id: selectedElementId });
          onSelectElement(null);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedElementId, dispatch, onSelectElement]);

  // Mouse down — start drag or start connection
  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getCanvasPos(e.clientX, e.clientY);
      const hit = hitTest(pos.x, pos.y, elements, connections);

      if (hit.type === "element" && hit.id) {
        if (connectingFrom) {
          // Complete connection
          if (connectingFrom !== hit.id) {
            addConnection(connectingFrom, hit.id, connectionType);
          }
          setConnectingFrom(null);
        } else if (e.shiftKey) {
          // Shift+click starts connection mode
          setConnectingFrom(hit.id);
        } else {
          // Regular click — select and start drag
          onSelectElement(hit.id);
          setDraggingElement(hit.id);
        }
      } else if (hit.type === "connection" && hit.id) {
        // Click connection to select (future: edit)
        onSelectElement(null);
      } else {
        // Click empty space
        onSelectElement(null);
        setConnectingFrom(null);
      }
    },
    [elements, connections, connectingFrom, connectionType, getCanvasPos, onSelectElement, addConnection],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getCanvasPos(e.clientX, e.clientY);
      setMousePos(pos);

      if (draggingElement) {
        dispatch({ type: "MOVE_ELEMENT", id: draggingElement, x: pos.x, y: pos.y });
      }
    },
    [draggingElement, getCanvasPos, dispatch],
  );

  const onMouseUp = useCallback(() => {
    setDraggingElement(null);
  }, []);

  // Drop from palette
  const onDrop = useCallback(
    (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const slug = e.dataTransfer.getData("application/tidal-pool-element");
      const item = paletteItems.find((p) => p.slug === slug);
      if (!item) return;

      const pos = getCanvasPos(e.clientX, e.clientY);
      const id = addElementFromPalette(item, pos.x, pos.y);
      onSelectElement(id);
    },
    [paletteItems, getCanvasPos, addElementFromPalette, onSelectElement],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  // Touch support
  const onTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0]!;
      const pos = getCanvasPos(touch.clientX, touch.clientY);
      const el = hitTestElement(pos.x, pos.y, elements);
      if (el) {
        onSelectElement(el.id);
        setDraggingElement(el.id);
      }
    },
    [elements, getCanvasPos, onSelectElement],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!draggingElement || e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0]!;
      const pos = getCanvasPos(touch.clientX, touch.clientY);
      dispatch({ type: "MOVE_ELEMENT", id: draggingElement, x: pos.x, y: pos.y });
    },
    [draggingElement, getCanvasPos, dispatch],
  );

  const onTouchEnd = useCallback(() => {
    setDraggingElement(null);
  }, []);

  return (
    <div className="relative flex-1 min-h-0 rounded-xl overflow-hidden border border-white/10">
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="w-full h-full cursor-crosshair"
        role="application"
        aria-label="tidal pool simulation canvas"
        tabIndex={0}
      />

      {/* Connection mode hint */}
      {connectingFrom && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur rounded-full text-xs text-[var(--color-text-on-dark)]">
          click another element to connect · esc to cancel
        </div>
      )}

      {/* Hint when empty */}
      {elements.length > 0 && connections.length === 0 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/40 backdrop-blur rounded-full text-xs text-[var(--color-text-on-dark-muted)]">
          shift+click an element to start drawing a connection
        </div>
      )}

      {/* Expose connection type setter for ConnectionDrawer */}
      <input
        type="hidden"
        data-connecting-from={connectingFrom ?? ""}
        data-connection-type={connectionType}
      />
    </div>
  );
}

// Re-export for parent to control connection drawing state
export type { ConnectionType };
