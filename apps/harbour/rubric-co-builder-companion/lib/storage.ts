// sessionStorage-backed persistence for the in-progress rubric draft.
// One key per browser tab — the worksheet survives refreshes but doesn't
// leak across tabs or persist longer than the session.
//
// Falls back to in-memory state if sessionStorage is unavailable (private
// browsing, quota exceeded). The worksheet still works; it just won't
// survive a refresh.

import type { Draft } from "./types";

const KEY = "rcb-c:draft";

export function loadDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

export function saveDraft(d: Draft): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ ...d, updated_at: new Date().toISOString() }),
    );
  } catch {
    // best-effort
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // best-effort
  }
}
