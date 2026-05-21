// Stale-state guard: rejects participant submissions that arrive after
// the room has moved on. Without this, a slow participant on the vote
// screen can have their POST land seconds after the host advanced to
// scale, and the vote would silently get counted into round 2's data.
//
// The fix is a 409 with a clear "the room moved on" payload. The client
// can use it to refresh and re-render to the current state.

import type { RoomState } from "./types";

export type StaleStateResponse = {
  error: "stale_state";
  current_state: RoomState;
  expected: RoomState[];
};

/**
 * Returns a NextResponse-shaped payload if `actual` isn't in `expected`,
 * or null if the submission is OK.
 */
export function staleStateGuard(
  actual: RoomState,
  expected: RoomState[],
): StaleStateResponse | null {
  if (expected.includes(actual)) return null;
  return {
    error: "stale_state",
    current_state: actual,
    expected,
  };
}

// Quorum guard (Maria audit #2): tally endpoints succeed with zero
// participant input today. A facilitator who clicks "tally" before any
// student has voted ends up with an empty / nonsensical rubric. Each
// tally route now counts the relevant input and refuses to advance if
// the count is below `required` (default 1) — unless the host explicitly
// passes `{ force: true }` in the POST body.

export type NoQuorumResponse = {
  ok: false;
  reason: "no_quorum";
  what: string; // human-readable description of what was missing
  required: number;
  found: number;
};

/**
 * Returns a NextResponse-shaped payload if `found < required`, otherwise
 * null. `what` is a short human-readable label like "round 1 votes" that
 * the client can show to the host (e.g., "you can't tally yet — no
 * <what> have been cast").
 */
export function quorumGuard(
  what: string,
  found: number,
  required = 1,
): NoQuorumResponse | null {
  if (found >= required) return null;
  return { ok: false, reason: "no_quorum", what, required, found };
}

/**
 * Best-effort `force` extraction from a POST body. Tally routes are
 * mostly empty-body POSTs today; this lets them adopt `{ force: true }`
 * without breaking existing callers. Returns false on any parse error.
 */
export async function readForceFlag(req: Request): Promise<boolean> {
  try {
    const body = (await req.clone().json()) as { force?: unknown } | null;
    return body?.force === true;
  } catch {
    return false;
  }
}
