import type { Modifier } from "@dnd-kit/core";

// Locks timeline drags to the horizontal axis and snaps the live transform to
// whole-day increments, so the dragged ghost moves one day at a time and never
// drifts vertically. dayWidthPx comes from the active scale.
export function createTimelineAxisModifier(dayWidthPx: number): Modifier {
  return ({ transform }) => ({
    ...transform,
    x: Math.round(transform.x / dayWidthPx) * dayWidthPx,
    y: 0,
  });
}
