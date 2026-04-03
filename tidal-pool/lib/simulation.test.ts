/**
 * tidal.pool — simulation engine tests
 *
 * Run with: node --test lib/simulation.test.ts
 * (requires Node 22+ with built-in test runner + tsx loader)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeDeltas,
  applyDeltas,
  simulateTick,
  isEquilibrium,
  detectLoops,
  createEmptyPool,
} from "./simulation";
import type { PoolElement, Connection, PoolState } from "./types";

// ── helpers ─────────────────────────────────────────────────

function makeElement(
  overrides: Partial<PoolElement> & { id: string },
): PoolElement {
  return {
    slug: overrides.id,
    label: overrides.id,
    icon: "🔵",
    category: "natural",
    value: 50,
    minValue: 0,
    maxValue: 100,
    x: 0,
    y: 0,
    color: "#3B82F6",
    ...overrides,
  };
}

function makeConnection(
  overrides: Partial<Connection> & { id: string; from: string; to: string },
): Connection {
  return {
    type: "amplifying",
    strength: 0.5,
    delay: 0,
    threshold: 0,
    ...overrides,
  };
}

// ── computeDeltas ───────────────────────────────────────────

describe("computeDeltas", () => {
  it("computes amplifying flow", () => {
    const elements = [makeElement({ id: "a", value: 80 }), makeElement({ id: "b", value: 20 })];
    const connections = [makeConnection({ id: "c1", from: "a", to: "b", type: "amplifying", strength: 0.5 })];

    const deltas = computeDeltas(elements, connections, 1);
    assert.ok(deltas["b"]! > 0, "b should increase from amplifying connection");
    assert.equal(deltas["a"], 0, "a has no incoming connections");
  });

  it("computes dampening flow", () => {
    const elements = [makeElement({ id: "a", value: 80 }), makeElement({ id: "b", value: 50 })];
    const connections = [makeConnection({ id: "c1", from: "a", to: "b", type: "dampening", strength: 0.5 })];

    const deltas = computeDeltas(elements, connections, 1);
    assert.ok(deltas["b"]! < 0, "b should decrease from dampening connection");
  });

  it("respects threshold", () => {
    const elements = [makeElement({ id: "a", value: 30 }), makeElement({ id: "b", value: 50 })];
    const connections = [
      makeConnection({ id: "c1", from: "a", to: "b", type: "threshold", strength: 0.5, threshold: 50 }),
    ];

    const deltas = computeDeltas(elements, connections, 1);
    assert.equal(deltas["b"], 0, "threshold not met, no flow");
  });

  it("fires when threshold is met", () => {
    const elements = [makeElement({ id: "a", value: 60 }), makeElement({ id: "b", value: 50 })];
    const connections = [
      makeConnection({ id: "c1", from: "a", to: "b", type: "threshold", strength: 0.5, threshold: 50 }),
    ];

    const deltas = computeDeltas(elements, connections, 1);
    assert.ok(deltas["b"]! > 0, "threshold met, flow should happen");
  });

  it("respects delay", () => {
    const elements = [makeElement({ id: "a", value: 80 }), makeElement({ id: "b", value: 50 })];
    const connections = [
      makeConnection({ id: "c1", from: "a", to: "b", type: "delayed", strength: 0.5, delay: 3 }),
    ];

    const deltasAt1 = computeDeltas(elements, connections, 1);
    assert.equal(deltasAt1["b"], 0, "delay not elapsed at tick 1");

    const deltasAt3 = computeDeltas(elements, connections, 3);
    assert.ok(deltasAt3["b"]! > 0, "delay elapsed at tick 3");
  });
});

// ── applyDeltas ─────────────────────────────────────────────

describe("applyDeltas", () => {
  it("clamps to maxValue", () => {
    const elements = [makeElement({ id: "a", value: 95, maxValue: 100 })];
    const result = applyDeltas(elements, { a: 10 });
    assert.equal(result[0]!.value, 100);
  });

  it("clamps to minValue", () => {
    const elements = [makeElement({ id: "a", value: 5, minValue: 0 })];
    const result = applyDeltas(elements, { a: -10 });
    assert.equal(result[0]!.value, 0);
  });

  it("returns same object when delta is 0", () => {
    const elements = [makeElement({ id: "a", value: 50 })];
    const result = applyDeltas(elements, { a: 0 });
    assert.equal(result[0], elements[0]);
  });
});

// ── simulateTick ────────────────────────────────────────────

describe("simulateTick", () => {
  it("advances tick counter", () => {
    const state: PoolState = {
      ...createEmptyPool(),
      elements: [makeElement({ id: "a" })],
    };
    const next = simulateTick(state);
    assert.equal(next.tick, 1);
  });

  it("records history snapshot", () => {
    const state: PoolState = {
      ...createEmptyPool(),
      elements: [makeElement({ id: "a", value: 50 })],
    };
    const next = simulateTick(state);
    assert.equal(next.history.length, 1);
    assert.equal(next.history[0]!.values["a"], 50);
  });

  it("propagates flow through connections", () => {
    const state: PoolState = {
      ...createEmptyPool(),
      elements: [
        makeElement({ id: "rain", value: 80 }),
        makeElement({ id: "crops", value: 30 }),
      ],
      connections: [
        makeConnection({ id: "c1", from: "rain", to: "crops", type: "amplifying", strength: 0.5 }),
      ],
    };
    const next = simulateTick(state);
    assert.ok(next.elements[1]!.value > 30, "crops should increase");
  });
});

// ── isEquilibrium ───────────────────────────────────────────

describe("isEquilibrium", () => {
  it("returns false with < 2 history entries", () => {
    assert.equal(isEquilibrium(createEmptyPool()), false);
  });

  it("returns true when values are stable", () => {
    const state: PoolState = {
      ...createEmptyPool(),
      history: [
        { tick: 1, values: { a: 50.005 } },
        { tick: 2, values: { a: 50.006 } },
      ],
    };
    assert.equal(isEquilibrium(state), true);
  });

  it("returns false when values are changing", () => {
    const state: PoolState = {
      ...createEmptyPool(),
      history: [
        { tick: 1, values: { a: 50 } },
        { tick: 2, values: { a: 55 } },
      ],
    };
    assert.equal(isEquilibrium(state), false);
  });
});

// ── detectLoops ─────────────────────────────────────────────

describe("detectLoops", () => {
  it("detects a simple cycle", () => {
    const connections = [
      makeConnection({ id: "c1", from: "a", to: "b" }),
      makeConnection({ id: "c2", from: "b", to: "a" }),
    ];
    const loops = detectLoops(connections);
    assert.ok(loops.length > 0, "should detect at least one loop");
  });

  it("returns empty for acyclic graph", () => {
    const connections = [
      makeConnection({ id: "c1", from: "a", to: "b" }),
      makeConnection({ id: "c2", from: "b", to: "c" }),
    ];
    const loops = detectLoops(connections);
    assert.equal(loops.length, 0);
  });
});
