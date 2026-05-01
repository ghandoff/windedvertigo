/**
 * paper.trail — localStorage gallery storage
 *
 * Captures are stored client-side as base64 data URLs.
 * No auth required for basic gallery; R2 export is optional.
 */

import type { Capture } from "./types";

const STORAGE_KEY = "paper-trail:captures";

export function loadCaptures(): Capture[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCapture(capture: Capture): void {
  const captures = loadCaptures();
  captures.unshift(capture); // newest first
  localStorage.setItem(STORAGE_KEY, JSON.stringify(captures));
}

export function deleteCapture(id: string): void {
  const captures = loadCaptures().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(captures));
}

export function generateCaptureId(): string {
  return `pt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
