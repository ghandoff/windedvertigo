/**
 * tidal.pool — core types
 *
 * A stock-and-flow systems thinking simulation.
 * Elements are "stocks" (nodes with values), connections are
 * "flows" (directed causal edges between stocks).
 */

// ── Element (node) ──────────────────────────────────────────

export interface PoolElement {
  id: string;
  slug: string;
  label: string;
  icon: string;
  category: ElementCategory;
  value: number;
  minValue: number;
  maxValue: number;
  x: number;
  y: number;
  color: string;
}

export type ElementCategory =
  | "natural"
  | "economic"
  | "social"
  | "environmental";

// ── Connection (edge) ───────────────────────────────────────

export interface Connection {
  id: string;
  from: string;
  to: string;
  type: ConnectionType;
  strength: number; // 0–1 multiplier
  delay: number; // ticks (0 = immediate)
  threshold: number; // trigger value (0 = always active)
}

export type ConnectionType =
  | "amplifying"
  | "dampening"
  | "delayed"
  | "threshold";

// ── Pool state ──────────────────────────────────────────────

export interface PoolState {
  elements: PoolElement[];
  connections: Connection[];
  tick: number;
  history: ElementSnapshot[];
  playing: boolean;
  speed: SimSpeed;
}

/** A snapshot of all element values at a given tick. */
export interface ElementSnapshot {
  tick: number;
  values: Record<string, number>; // element id → value
}

export type SimSpeed = 1 | 2 | 4;

// ── Actions (reducer) ───────────────────────────────────────

export type PoolAction =
  | { type: "ADD_ELEMENT"; element: PoolElement }
  | { type: "REMOVE_ELEMENT"; id: string }
  | { type: "MOVE_ELEMENT"; id: string; x: number; y: number }
  | { type: "SET_VALUE"; id: string; value: number }
  | { type: "ADD_CONNECTION"; connection: Connection }
  | { type: "REMOVE_CONNECTION"; id: string }
  | { type: "TICK" }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "SET_SPEED"; speed: SimSpeed }
  | { type: "RESET" }
  | { type: "LOAD_SCENARIO"; scenario: Scenario }
  | { type: "FIT_TO_CANVAS"; width: number; height: number };

// ── Scenario (from Notion) ──────────────────────────────────

export interface Scenario {
  slug: string;
  name: string;
  description: string;
  difficulty: "explore" | "challenge" | "complex";
  elements: PoolElement[];
  connections: Connection[];
  challengePrompt: string;
  skillSlugs: string[];
}

// ── Palette element (template for drag-to-add) ──────────────

export interface PaletteItem {
  slug: string;
  label: string;
  icon: string;
  category: ElementCategory;
  defaultValue: number;
  color: string;
  description: string;
}
