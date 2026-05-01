/**
 * Per-user pending action store — confirm-before-mutate flow.
 *
 * Stores one pending write action per user (keyed by email). The action
 * is staged by a tool call and executed only after the user confirms.
 * Expires after PENDING_TTL_MS to avoid stale confirmations.
 *
 * One pending action per user is fine for a 2–3 person team. If two write
 * tool calls happen in the same turn, the last one wins; tell Claude to
 * only call one write tool per turn in the system prompt if that becomes
 * a problem.
 *
 * In-memory only: survives within a single Vercel function instance.
 * On cold start, any in-flight pending action is lost — the user will get
 * a "no pending action" error and can re-issue the request. Acceptable
 * at this team size; swap in Redis/KV when durability is required.
 */

import type { PendingAction } from "./types";

const PENDING_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface StoredAction {
  action: PendingAction;
  expiresAt: number;
}

/** email → pending action */
const store = new Map<string, StoredAction>();

/** Stage a pending action for a user. Overwrites any existing pending action. */
export function setPending(email: string, action: PendingAction): void {
  store.set(email.toLowerCase(), {
    action,
    expiresAt: Date.now() + PENDING_TTL_MS,
  });
}

/**
 * Retrieve the pending action for a user if it exists and hasn't expired.
 * Expired entries are evicted on access.
 */
export function getPending(email: string): PendingAction | null {
  const entry = store.get(email.toLowerCase());
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    store.delete(email.toLowerCase());
    return null;
  }

  return entry.action;
}

/** Remove the pending action for a user after it's been executed or cancelled. */
export function clearPending(email: string): void {
  store.delete(email.toLowerCase());
}

/** Exposed for tests — don't use in production paths. */
export function __clearStoreForTest(): void {
  store.clear();
}
