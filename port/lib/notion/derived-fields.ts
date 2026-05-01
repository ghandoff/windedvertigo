/**
 * Derived fields — computed from raw Notion properties at read time.
 *
 * These replace manually-set fields (priority) and unify overlapping ones
 * (friendship + connection + outreach status → relationship).
 */

import type {
  ConnectionStatus,
  Friendship,
  OutreachStatus,
  FitRating,
  Relationship,
  DerivedPriority,
} from "./types";

// ── relationship derivation ──────────────────────────────
//
// Maps the existing "connection" status property into the unified
// 7-stage relationship lifecycle. Once a dedicated "relationship"
// status property exists in Notion, this can read that directly.

const CONNECTION_TO_RELATIONSHIP: Record<string, Relationship> = {
  unengaged: "stranger",
  exploring: "aware",
  "in progress": "contacted",
  collaborating: "in conversation",
  champion: "collaborating",
  steward: "active partner",
  "past client": "active partner",
};

// Fallback: if the Notion connection status is empty but we have
// an outreach status, derive from that.
const OUTREACH_TO_RELATIONSHIP: Record<string, Relationship> = {
  "Not started": "stranger",
  Researching: "aware",
  Contacted: "contacted",
  "In conversation": "in conversation",
  "Proposal sent": "collaborating",
  "Active client": "active partner",
  "Opted out": "stranger",
};

// Second fallback: friendship → relationship
const FRIENDSHIP_TO_RELATIONSHIP: Record<string, Relationship> = {
  Stranger: "stranger",
  "Known-of / name in common": "aware",
  "Loose tie": "contacted",
  "Friendly contact": "in conversation",
  "Warm friend": "collaborating",
  "Inner circle": "champion",
};

/**
 * Derive the unified relationship stage from the three legacy fields.
 * Priority: connection > outreach status > friendship > "stranger".
 */
export function deriveRelationship(
  connection?: ConnectionStatus | string,
  outreachStatus?: OutreachStatus | string,
  friendship?: Friendship | string,
): Relationship {
  if (connection && CONNECTION_TO_RELATIONSHIP[connection]) {
    return CONNECTION_TO_RELATIONSHIP[connection];
  }
  if (outreachStatus && OUTREACH_TO_RELATIONSHIP[outreachStatus]) {
    return OUTREACH_TO_RELATIONSHIP[outreachStatus];
  }
  if (friendship && FRIENDSHIP_TO_RELATIONSHIP[friendship]) {
    return FRIENDSHIP_TO_RELATIONSHIP[friendship];
  }
  return "stranger";
}

// ── priority derivation ──────────────────────────────────

const RELATIONSHIP_RANK: Record<Relationship, number> = {
  stranger: 0,
  aware: 1,
  contacted: 2,
  "in conversation": 3,
  collaborating: 4,
  "active partner": 5,
  champion: 6,
};

/**
 * Derive priority tier from fit rating + relationship stage.
 *
 * Tier 1: perfect fit + relationship ≥ contacted, OR strong fit + relationship ≥ collaborating
 * Tier 2: strong fit + relationship ≥ contacted, OR moderate fit + relationship ≥ collaborating
 * Tier 3: everything else
 */
export function computePriority(
  fitRating?: FitRating | string,
  relationship?: Relationship | string,
): DerivedPriority {
  const rank = RELATIONSHIP_RANK[(relationship as Relationship) ?? "stranger"] ?? 0;
  const fit = fitRating ?? "";

  // Perfect fit
  if (fit.includes("Perfect")) {
    if (rank >= RELATIONSHIP_RANK.contacted) return "tier 1";
    return "tier 2";
  }

  // Strong fit
  if (fit.includes("Strong")) {
    if (rank >= RELATIONSHIP_RANK.collaborating) return "tier 1";
    if (rank >= RELATIONSHIP_RANK.contacted) return "tier 2";
    return "tier 3";
  }

  // Moderate fit
  if (fit.includes("Moderate")) {
    if (rank >= RELATIONSHIP_RANK.collaborating) return "tier 2";
    return "tier 3";
  }

  // No fit rating set
  return "tier 3";
}

/** All relationship stages in lifecycle order. */
export const RELATIONSHIP_STAGES: readonly Relationship[] = [
  "stranger",
  "aware",
  "contacted",
  "in conversation",
  "collaborating",
  "active partner",
  "champion",
] as const;
