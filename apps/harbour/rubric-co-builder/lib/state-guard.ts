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
