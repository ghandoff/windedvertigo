import type { Session, Team } from '@/state/types';
import { getAct } from '@/content/acts';

export function teamById(session: Session, id: string | null): Team | undefined {
  if (!id) return undefined;
  return session.teams.find((t) => t.id === id);
}

export function teamForParticipant(
  session: Session,
  participantId: string,
): Team | undefined {
  const p = session.participants.find((x) => x.id === participantId);
  if (!p || !p.teamId) return undefined;
  return teamById(session, p.teamId);
}

export function actTimeRemainingMs(session: Session, now: number = Date.now()): number {
  if (session.actStartedAt === undefined) return session.actDurationMs;
  const elapsed = now - session.actStartedAt;
  return Math.max(0, session.actDurationMs - elapsed);
}

export function auctionTimeRemainingMs(session: Session, now: number = Date.now()): number {
  if (!session.currentAuction) return 0;
  const elapsed = now - session.currentAuction.startedAt;
  return Math.max(0, session.currentAuction.durationMs - elapsed);
}

export function actIndex(session: Session): number {
  return getAct(session.currentAct).index;
}

export function bidsPerMinute(session: Session, windowMs = 60_000, now = Date.now()): number {
  const since = now - windowMs;
  const count = session.events.filter(
    (e) => e.type === 'bidPlaced' && e.at >= since,
  ).length;
  return count;
}

export function silentTeams(session: Session, windowMs = 60_000, now = Date.now()) {
  if (!session.currentAuction) return session.teams;
  const since = now - windowMs;
  const activeTeamIds = new Set(
    session.events
      .filter((e) => e.type === 'bidPlaced' && e.at >= since)
      .map((e) => e.payload.teamId as string),
  );
  return session.teams.filter((t) => !activeTeamIds.has(t.id));
}

export function totalParticipants(session: Session): number {
  return session.participants.filter((p) => p.role === 'participant').length;
}

export function teamMembers(session: Session, teamId: string) {
  return session.participants.filter((p) => p.teamId === teamId);
}

export function readyCount(session: Session): number {
  return session.participants.filter(
    (p) => p.role === 'participant' && p.ready === true,
  ).length;
}

export function latestBroadcast(session: Session) {
  return session.broadcasts[session.broadcasts.length - 1];
}

/**
 * brainstorm-wall responses with hidden entries filtered out.
 * when teamId is provided, only responses from that team are returned.
 * the participantId is intentionally not surfaced — anonymity is part of the contract.
 */
export function visibleBrainstorm(session: Session, teamId?: string | null) {
  const hidden = new Set(session.hiddenBrainstormIds);
  return session.brainstormResponses.filter(
    (r) => !hidden.has(r.id) && (teamId == null || r.teamId === teamId),
  );
}

export function brainstormSubmittedCount(session: Session): number {
  return session.participants.filter(
    (p) => p.role === 'participant' && p.brainstormSubmitted,
  ).length;
}

/**
 * count of votes per amount for a team / value. used to render the live
 * results bar and detect ≥60% consensus.
 */
export function pollTally(
  team: Team,
  valueId: string,
): { tally: Map<number, number>; total: number; leadingAmount: number | null; leadingShare: number } {
  const votes = team.polls[valueId] ?? {};
  const tally = new Map<number, number>();
  let total = 0;
  for (const amount of Object.values(votes)) {
    tally.set(amount, (tally.get(amount) ?? 0) + 1);
    total += 1;
  }
  let leadingAmount: number | null = null;
  let leadingCount = 0;
  for (const [amount, count] of tally) {
    if (count > leadingCount) {
      leadingCount = count;
      leadingAmount = amount;
    }
  }
  const leadingShare = total > 0 ? leadingCount / total : 0;
  return { tally, total, leadingAmount, leadingShare };
}

export function plannedSpend(team: Team): number {
  return Object.values(team.lockedBids ?? {}).reduce((sum, n) => sum + n, 0);
}

export function isCaptain(team: Team, participantId: string): boolean {
  return team.captainParticipantId === participantId;
}

export function decidedCount(team: Team, remainingValueIds: string[]): number {
  return remainingValueIds.filter((v) => v in (team.lockedBids ?? {})).length;
}

/**
 * For a given value, returns the captain's pre-agreed bid: locked if set,
 * otherwise the leading poll amount (or 0 if no votes). this is what
 * pre-fills the bid field when a value comes up in the auction.
 */
export function preAgreedBid(team: Team, valueId: string): number {
  if (team.lockedBids && valueId in team.lockedBids) return team.lockedBids[valueId]!;
  const tally = pollTally(team, valueId);
  return tally.leadingAmount ?? 0;
}
