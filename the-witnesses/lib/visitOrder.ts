import type { CharacterKey } from "./session";

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Act-weighted shuffle:
 * Act I:   Builder, Explorer      (warm-up)
 * Act II:  Ripple, Trickster     (widen + disrupt)
 * Act III: Ghost, Time-Traveler  (gravity)
 *
 * Shuffle within each act, then concatenate.
 */
export function generateVisitOrder(): CharacterKey[] {
  const actI: CharacterKey[] = shuffleArray(["builder", "explorer"]);
  const actII: CharacterKey[] = shuffleArray(["ripple", "trickster"]);
  const actIII: CharacterKey[] = shuffleArray(["ghost", "timeTraveler"]);
  return [...actI, ...actII, ...actIII];
}
