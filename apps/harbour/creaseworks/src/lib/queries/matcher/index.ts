/**
 * Matcher algorithm — queries, scoring, and ranking.
 *
 * MVP 3 — playdate matcher.
 *
 * Strategy: fetch all ready playdates with their materials in a single query,
 * then score and rank in TypeScript. Batch queries for entitlements and pack
 * slugs to avoid N+1.
 */

/* Re-export types */
export type {
  MatcherInput,
  RankedPlaydate,
  MatcherResult,
  CandidateRow,
  PlaydateCandidate,
  SessionSlice,
} from "./types";

/* Re-export picker queries */
export { getDistinctForms, getDistinctSlots, getDistinctContexts } from "./picker-queries";

/* Re-export candidate cache and grouping */
export { invalidateCandidateCache, getCandidateRows, groupCandidates } from "./candidate-cache";

/* Re-export scoring */
export { scorePlaydate } from "./scoring";

/* Re-export orchestrator */
export { performMatching } from "./orchestrator";
