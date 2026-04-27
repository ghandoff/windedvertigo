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
