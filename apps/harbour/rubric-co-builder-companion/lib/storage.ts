// sessionStorage-backed persistence for the in-progress rubric draft.
// One key per browser tab — the worksheet survives refreshes but doesn't
// leak across tabs or persist longer than the session.
//
// Falls back to in-memory state if sessionStorage is unavailable (private
// browsing, quota exceeded). The worksheet still works; it just won't
// survive a refresh.

import type { Draft } from "./types";

// Key version bumped 2026-05-20 (PRME launch): Pledge shape changed from
// { text: string } to a 5-field object. Loading an old-shape draft would
// silently mis-render the pledge step. Bumping the key abandons any
// pre-PRME drafts (held only in sessionStorage = same browser tab) so we
// never try to migrate them.
const KEY = "rcb-c:draft:v2";

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
