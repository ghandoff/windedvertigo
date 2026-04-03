"use client";

/**
 * tidal.pool — canvas lifecycle hook
 *
 * Manages the canvas element, DPR scaling, resize observer,
 * and the draw loop. Delegates all rendering to canvas-renderer.ts.
 */

import { useRef, useEffect, useCallback } from "react";
import { draw } from "@/lib/canvas-renderer";
import type { PoolElement, Connection } from "@/lib/types";

interface UsePoolCanvasOptions {
  elements: PoolElement[];
  connections: Connection[];
  tick: number;
  selectedElementId: string | null;
  connectingFrom: string | null;
  mousePos: { x: number; y: number } | null;
}

export function usePoolCanvas(opts: UsePoolCanvasOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const rafRef = useRef<number>(0);

  // Resize canvas to fill container with correct DPR
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  }, []);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    resize();

    // Observe container resize
    const parent = canvas.parentElement;
    const observer = parent
      ? new ResizeObserver(() => resize())
      : null;
    if (observer && parent) observer.observe(parent);

    function frame() {
      const dpr = window.devicePixelRatio || 1;
      draw(ctx!, {
        ...optsRef.current,
        dpr,
      });
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      observer?.disconnect();
    };
  }, [resize]);

  // Get canvas-relative coordinates from a mouse/touch event
  const getCanvasPos = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    [],
  );

  return { canvasRef, getCanvasPos };
}
