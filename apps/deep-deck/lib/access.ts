import type { PackId } from "./types";

const STORAGE_KEY = "dd_access";

interface AccessGrant {
  packs: PackId[];
  /** ISO timestamp of when access was granted */
  grantedAt: string;
  /** Stripe checkout session ID for verification */
  sessionId?: string;
}

/** Get current entitlements from local storage. Always includes "sampler". */
export function getEntitlements(): PackId[] {
  if (typeof window === "undefined") return ["sampler"];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ["sampler"];
    const grant: AccessGrant = JSON.parse(raw);
    const packs = new Set<PackId>(["sampler", ...grant.packs]);
    return Array.from(packs);
  } catch {
    return ["sampler"];
  }
}

/** Check if user has access to a specific pack. */
export function hasAccess(pack: PackId): boolean {
  if (pack === "sampler") return true;
  return getEntitlements().includes(pack);
}

/** Grant access to a pack after successful purchase. */
export function grantAccess(pack: PackId, sessionId?: string): void {
  if (typeof window === "undefined") return;

  const current = getEntitlements();
  const packs = Array.from(new Set([...current, pack]));

  const grant: AccessGrant = {
    packs,
    grantedAt: new Date().toISOString(),
    sessionId,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(grant));
}

/** Check if user has the full deck. */
export function hasFullDeck(): boolean {
  return hasAccess("full");
}
