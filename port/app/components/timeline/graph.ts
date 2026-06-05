// Dependency-graph utilities for the timeline: cycle detection (for link
// editing) and a finish-to-start forward-pass cascade (for critical-path
// auto-shift). Pure functions — no React, no DOM — so they're easy to reason
// about and reuse on the server (cycle check) and client (preview).

import { addDays, daysBetween } from "./scale";

export interface DepNode {
  id: string;
  dependsOn: string[];
  start?: string | null; // YYYY-MM-DD
  end?: string | null; // YYYY-MM-DD
}

/**
 * Would adding "successor depends on predecessor" create a cycle?
 * True if predecessor already (transitively) depends on successor, or if they're
 * the same node. Run this BEFORE writing a new link.
 */
export function wouldCreateCycle(
  nodes: DepNode[],
  predecessorId: string,
  successorId: string,
): boolean {
  if (predecessorId === successorId) return true;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const stack = [predecessorId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === successorId) return true; // path pred → … → succ exists
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const d of byId.get(cur)?.dependsOn ?? []) stack.push(d);
  }
  return false;
}

export interface CascadeUpdate {
  id: string;
  start: string;
  end: string;
}

/**
 * After `changedId` moves to (newStart, newEnd), shift every transitive
 * dependent forward so each successor starts no earlier than its predecessor
 * ends (finish-to-start). Preserves each task's duration. Only ever shifts
 * forward — never pulls a task earlier. Returns the set of updates (excluding
 * the changed node itself).
 */
export function cascadeShifts(
  nodes: DepNode[],
  changedId: string,
  newStart: string,
  newEnd: string,
): CascadeUpdate[] {
  // successors[X] = nodes that depend on X
  const successors = new Map<string, string[]>();
  for (const n of nodes) {
    for (const dep of n.dependsOn) {
      if (!successors.has(dep)) successors.set(dep, []);
      successors.get(dep)!.push(n.id);
    }
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  // working copy of current dates
  const dates = new Map<string, { start: string; end: string }>();
  for (const n of nodes) {
    if (n.start && n.end) dates.set(n.id, { start: n.start, end: n.end });
  }
  dates.set(changedId, { start: newStart, end: newEnd });

  const updates = new Map<string, CascadeUpdate>();
  const queue = [changedId];
  let guard = 0;
  const cap = nodes.length * nodes.length + 1; // safety bound (graph is acyclic)

  while (queue.length && guard++ < cap) {
    const cur = queue.shift()!;
    const curDates = dates.get(cur);
    if (!curDates) continue;

    for (const succId of successors.get(cur) ?? []) {
      const succ = dates.get(succId);
      if (!succ || !byId.get(succId)?.start) continue; // can't shift an unscheduled task

      const gap = daysBetween(curDates.end, succ.start); // succ.start − pred.end
      if (gap >= 0) continue; // already valid (starts at/after predecessor ends)

      const shift = -gap; // days to push forward
      const start = addDays(succ.start, shift);
      const end = addDays(succ.end, shift);
      dates.set(succId, { start, end });
      updates.set(succId, { id: succId, start, end });
      queue.push(succId);
    }
  }

  return Array.from(updates.values());
}
