/**
 * @windedvertigo/mirror-log — localStorage adapter
 *
 * Reads/writes reflections to a namespaced localStorage key.
 * Works across all harbour apps sharing the same origin.
 */

import type { Reflection } from "./types";

const STORAGE_KEY = "mirror-log:reflections";

export function loadReflections(): Reflection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Reflection[];
  } catch {
    return [];
  }
}

export function saveReflection(reflection: Reflection): void {
  if (typeof window === "undefined") return;
  const existing = loadReflections();
  existing.push(reflection);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function getReflectionsByApp(sourceApp: string): Reflection[] {
  return loadReflections().filter((r) => r.sourceApp === sourceApp);
}

export function getReflectionsBySkill(skillSlug: string): Reflection[] {
  return loadReflections().filter((r) => r.skillSlugs.includes(skillSlug));
}

export function getReflectionStreak(): number {
  const reflections = loadReflections();
  if (reflections.length === 0) return 0;

  // Count consecutive days with at least one reflection
  const days = new Set(
    reflections.map((r) => r.timestamp.slice(0, 10)),
  );
  const sortedDays = [...days].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);

  let streak = 0;
  let expectedDate = today;

  for (const day of sortedDays) {
    if (day === expectedDate) {
      streak++;
      // Move to previous day
      const d = new Date(expectedDate);
      d.setDate(d.getDate() - 1);
      expectedDate = d.toISOString().slice(0, 10);
    } else if (day < expectedDate) {
      break;
    }
  }

  return streak;
}
