import type {
  AiUseLevel,
  AiUseProposal,
  AiUseProposalVote,
  AiUseVote,
} from "./types";
import { AI_USE_LEVELS } from "./types";

// tie-break: favour the lower-numbered rung (more conservative ceiling).
export function computeCeiling(
  votes: AiUseVote[],
): { ceiling: AiUseLevel; counts: Record<AiUseLevel, number>; total: number } {
  const counts: Record<AiUseLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const v of votes) counts[v.level]++;
  let ceiling: AiUseLevel = 0;
  let best = -1;
  for (const lvl of [0, 1, 2, 3, 4] as AiUseLevel[]) {
    if (counts[lvl] > best) {
      best = counts[lvl];
      ceiling = lvl;
    }
  }
  return { ceiling, counts, total: votes.length };
}

// the new flow: proposal votes sum up to a count per level.
export function computeCeilingFromProposals(
  proposals: AiUseProposal[],
  proposalVotes: AiUseProposalVote[],
): { ceiling: AiUseLevel; counts: Record<AiUseLevel, number>; total: number } {
  const perProposal = new Map<string, number>();
  for (const v of proposalVotes) {
    perProposal.set(v.proposal_id, (perProposal.get(v.proposal_id) ?? 0) + 1);
  }
  const counts: Record<AiUseLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const p of proposals) {
    counts[p.level] += perProposal.get(p.id) ?? 0;
  }
  let ceiling: AiUseLevel = 0;
  let best = -1;
  for (const lvl of [0, 1, 2, 3, 4] as AiUseLevel[]) {
    if (counts[lvl] > best) {
      best = counts[lvl];
      ceiling = lvl;
    }
  }
  return { ceiling, counts, total: proposalVotes.length };
}

export function levelMeta(level: AiUseLevel) {
  return AI_USE_LEVELS.find((l) => l.level === level) ?? AI_USE_LEVELS[0];
}
