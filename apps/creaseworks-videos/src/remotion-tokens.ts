// mirrors packages/motion-kit/tokens.ts — same values, Remotion-native API
// update here if motion-kit tokens change

export const duration = {
  instant: 0,
  fast: 120,
  base: 240,
  slow: 400,
  cinematic: 700,
} as const;

// convert ms to Remotion frames at 30fps
export const frames = (ms: number) => Math.round((ms / 1000) * 30);

export const easing = {
  enter: [0, 0, 0.2, 1] as [number, number, number, number],
  exit: [0.4, 0, 1, 1] as [number, number, number, number],
  sharp: [0.4, 0, 0.6, 1] as [number, number, number, number],
} as const;

export const brand = {
  cadet: "#273248",
  redwood: "#b15043",
  cream: "#f7f5f2",
  white: "#ffffff",
} as const;
