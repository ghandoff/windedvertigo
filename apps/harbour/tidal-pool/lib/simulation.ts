/**
 * tidal.pool — simulation engine
 *
 * Pure functions that advance the pool state by one tick.
 * No side effects, no DOM, no React — fully testable.
 *
 * The model is stock-and-flow: elements are stocks (values that
 * accumulate), connections are flows (causal relationships that
 * move value between stocks each tick).
 */

import type {
  PoolElement,
  Connection,
  PoolState,
  ElementSnapshot,
} from "./types";

/**
 * Compute deltas for all elements based on incoming connections.
 * Returns a map of element id → delta value to apply.
 *
 * All deltas are computed from the *current* state before any
 * are applied, preventing order-dependent bugs.
 */
export function computeDeltas(
  elements: PoolElement[],
  connections: Connection[],
  tick: number,
): Record<string, number> {
  const valueMap = new Map(elements.map((e) => [e.id, e.value]));
  const deltas: Record<string, number> = {};

  for (const el of elements) {
    deltas[el.id] = 0;
  }

  for (const conn of connections) {
    const sourceValue = valueMap.get(conn.from);
    if (sourceValue === undefined) continue;
    if (!(conn.to in deltas)) continue;

    // Delayed connections only fire after enough ticks
    if (conn.type === "delayed" && conn.delay > 0) {
      if (tick % conn.delay !== 0) continue;
    }

    // Threshold connections only fire when source crosses the threshold
    if (conn.type === "threshold" && conn.threshold > 0) {
      if (sourceValue < conn.threshold) continue;
    }

    // Compute flow: source value normalized to 0–1, scaled by strength
    const normalizedSource = sourceValue / 100;
    const flow = normalizedSource * conn.strength * 2; // scale factor for visible effect

    if (conn.type === "dampening") {
      deltas[conn.to] -= flow;
    } else {
      deltas[conn.to] += flow;
    }
  }

  return deltas;
}

/**
 * Apply deltas to elements, clamping values to [minValue, maxValue].
 * Returns new element array (immutable).
 */
export function applyDeltas(
  elements: PoolElement[],
  deltas: Record<string, number>,
): PoolElement[] {
  return elements.map((el) => {
    const delta = deltas[el.id] ?? 0;
    if (delta === 0) return el;

    const newValue = Math.max(
      el.minValue,
      Math.min(el.maxValue, el.value + delta),
    );
    return { ...el, value: newValue };
  });
}

/**
 * Take a snapshot of current element values.
 */
export function takeSnapshot(
  elements: PoolElement[],
  tick: number,
): ElementSnapshot {
  const values: Record<string, number> = {};
  for (const el of elements) {
    values[el.id] = el.value;
  }
  return { tick, values };
}

/**
 * Advance the pool by one tick. Pure function.
 */
export function simulateTick(state: PoolState): PoolState {
  const nextTick = state.tick + 1;
  const deltas = computeDeltas(state.elements, state.connections, nextTick);
  const nextElements = applyDeltas(state.elements, deltas);
  const snapshot = takeSnapshot(nextElements, nextTick);

  return {
    ...state,
    elements: nextElements,
    tick: nextTick,
    history: [...state.history, snapshot],
  };
}

/**
 * Check if the pool has reached equilibrium (no meaningful change).
 * Useful for auto-pausing the simulation.
 */
export function isEquilibrium(
  state: PoolState,
  threshold = 0.01,
): boolean {
  if (state.history.length < 2) return false;

  const prev = state.history[state.history.length - 2];
  const curr = state.history[state.history.length - 1];
  if (!prev || !curr) return false;

  for (const id of Object.keys(curr.values)) {
    const delta = Math.abs((curr.values[id] ?? 0) - (prev.values[id] ?? 0));
    if (delta > threshold) return false;
  }
  return true;
}

/**
 * Detect feedback loops in the connection graph.
 * Returns arrays of element IDs forming cycles.
 */
export function detectLoops(connections: Connection[]): string[][] {
  const adj = new Map<string, string[]>();
  for (const conn of connections) {
    const existing = adj.get(conn.from) ?? [];
    existing.push(conn.to);
    adj.set(conn.from, existing);
  }

  const loops: string[][] = [];
  const visited = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (path.includes(node)) {
      const loopStart = path.indexOf(node);
      loops.push(path.slice(loopStart));
      return;
    }
    if (visited.has(node)) return;

    path.push(node);
    for (const neighbor of adj.get(node) ?? []) {
      dfs(neighbor, [...path]);
    }
    visited.add(node);
  }

  for (const node of adj.keys()) {
    dfs(node, []);
  }

  return loops;
}

// ── Initial state factory ───────────────────────────────────

export function createEmptyPool(): PoolState {
  return {
    elements: [],
    connections: [],
    tick: 0,
    history: [],
    playing: false,
    speed: 1,
  };
}
