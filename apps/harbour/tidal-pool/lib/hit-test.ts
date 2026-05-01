/**
 * tidal.pool — canvas hit-testing
 *
 * Maps mouse/touch positions to elements and connections
 * on the canvas. Used for selection, dragging, and
 * connection drawing.
 */

import type { PoolElement, Connection } from "./types";
import { NODE_RADIUS } from "./canvas-renderer";

export interface HitResult {
  type: "element" | "connection" | "none";
  id: string | null;
}

/**
 * Test if a point hits an element (circle hit test).
 */
export function hitTestElement(
  x: number,
  y: number,
  elements: PoolElement[],
): PoolElement | null {
  // Test in reverse order so top-most element is hit first
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]!;
    const dx = x - el.x;
    const dy = y - el.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= NODE_RADIUS + 4) {
      return el;
    }
  }
  return null;
}

/**
 * Test if a point is near a connection line.
 */
export function hitTestConnection(
  x: number,
  y: number,
  connections: Connection[],
  elements: PoolElement[],
  tolerance = 8,
): Connection | null {
  for (const conn of connections) {
    const from = elements.find((e) => e.id === conn.from);
    const to = elements.find((e) => e.id === conn.to);
    if (!from || !to) continue;

    const dist = pointToLineDistance(x, y, from.x, from.y, to.x, to.y);
    if (dist <= tolerance) return conn;
  }
  return null;
}

/**
 * Combined hit test: check elements first (higher priority), then connections.
 */
export function hitTest(
  x: number,
  y: number,
  elements: PoolElement[],
  connections: Connection[],
): HitResult {
  const element = hitTestElement(x, y, elements);
  if (element) return { type: "element", id: element.id };

  const connection = hitTestConnection(x, y, connections, elements);
  if (connection) return { type: "connection", id: connection.id };

  return { type: "none", id: null };
}

/**
 * Distance from point (px, py) to line segment (x1,y1)→(x2,y2).
 */
function pointToLineDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}
