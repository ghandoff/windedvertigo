import type { Modifier } from "@dnd-kit/core";

// Locks timeline MOVE/RESIZE drags to the horizontal axis and snaps the live
// transform to whole-day increments. LINK drags (id prefixed "link:") pass
// through untouched — they need free 2D movement to reach a bar in another lane.
export function createTimelineAxisModifier(dayWidthPx: number): Modifier {
  return ({ transform, active }) => {
    if (active && String(active.id).startsWith("link:")) return transform;
    return {
      ...transform,
      x: Math.round(transform.x / dayWidthPx) * dayWidthPx,
      y: 0,
    };
  };
}
