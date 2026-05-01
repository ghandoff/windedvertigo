/**
 * Haptic feedback for mobile interactions.
 *
 * Uses the Vibration API — progressive enhancement, no-op on
 * unsupported devices. Respects reduced-motion preference.
 */

export function haptic(type: "light" | "medium" | "heavy" = "light") {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  if (typeof document !== "undefined" && document.documentElement.classList.contains("reduce-motion")) return;
  const durations = { light: 10, medium: 25, heavy: 50 };
  navigator.vibrate(durations[type]);
}
