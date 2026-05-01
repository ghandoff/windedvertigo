/* ── anxiety map data model ────────────────────────────────────── */

export interface HCA {
  id: string;
  label: string;
  frequency: number; // 1-4
  color: string;
  shape: NodeShape;
}

export interface PCRRating {
  sourceId: string;
  targetId: string;
  strength: number; // 0-4
}

export type Phase = "intro" | "input" | "mapping" | "visualisation" | "focus";

export interface MapSession {
  phase: Phase;
  childName: string;
  hcas: HCA[];
  ratings: PCRRating[];
  currentPairIndex: number;
}

/* ── computed types (never stored) ────────────────────────────── */

export interface NetworkNode {
  hca: HCA;
  outStrength: number;
  inStrength: number;
  centrality: number; // normalised 0-1
  x: number;
  y: number;
}

export interface NetworkEdge {
  sourceId: string;
  targetId: string;
  strength: number; // 1-4 (0 = no edge)
}

export interface DirectedPair {
  sourceId: string;
  targetId: string;
}

/* ── node shapes for colour-blind safety ─────────────────────── */

export type NodeShape =
  | "circle"
  | "square"
  | "diamond"
  | "triangle"
  | "hexagon"
  | "star";

/* ── reducer ─────────────────────────────────────────────────── */

export type MapAction =
  | { type: "SET_NAME"; name: string }
  | { type: "ADD_HCA"; label: string; frequency: number }
  | { type: "REMOVE_HCA"; id: string }
  | { type: "SET_FREQUENCY"; id: string; frequency: number }
  | { type: "RATE_PAIR"; sourceId: string; targetId: string; strength: number }
  | { type: "NEXT_PAIR" }
  | { type: "SKIP_PAIR" }
  | { type: "SET_PHASE"; phase: Phase }
  | { type: "RESET" };
