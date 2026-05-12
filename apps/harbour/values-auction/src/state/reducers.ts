import type {
  Action,
  Session,
  SessionEvent,
  Team,
  Auction,
  Participant,
} from '@/state/types';
import { PRACTICE_CREDOS, PRACTICE_VALUE_ID } from '@/state/types';
import { getAct, nextAct } from '@/content/acts';
import { VALUES } from '@/content/values';
import { STARTUPS } from '@/content/startups';
import { TEAM_COLOURS, teamDisplayName, uid } from '@/utils/id';

export const STARTING_CREDOS = 150;
export const DEFAULT_AUCTION_MS = 60_000;
export const PRACTICE_AUCTION_MS = 45_000;
export const BID_INCREMENT = 1;
export const CAPTAIN_GRACE_MS = 60_000;

export const BRAINSTORM_MAX_LEN = 80;

export function initialSession(sessionId: string, facilitatorId: string): Session {
  const now = Date.now();
  return {
    id: sessionId,
    createdAt: now,
    currentAct: 'arrival',
    actDurationMs: getAct('arrival').durationMs,
    facilitatorId,
    teams: [],
    participants: [],
    valueDeck: VALUES.map((v) => v.id),
    completedAuctions: [],
    events: [],
    broadcasts: [],
    mutedTeamIds: [],
    brainstormResponses: [],
    hiddenBrainstormIds: [],
    practiceCredos: {},
    practiceCompleted: false,
  };
}

function event(
  type: SessionEvent['type'],
  payload: Record<string, unknown> = {},
  at = Date.now(),
): SessionEvent {
  return { id: uid('evt'), at, type, payload };
}

function pushEvent(session: Session, ev: SessionEvent): Session {
  return { ...session, events: [...session.events, ev] };
}

/**
 * the practice round shares its bid mechanic with the real auction, but
 * the practice value is never in the real deck and never deducts credos.
 */
function isPracticeAuction(session: Session): boolean {
  return Boolean(session.currentAuction?.practice);
}

/**
 * defensive: existing cached sessions may pre-date the new team fields.
 * normalise on load so reducer code never has to optional-chain into them.
 */
function normaliseTeam(t: Team): Team {
  return {
    ...t,
    polls: t.polls ?? {},
    lockedBids: t.lockedBids ?? {},
  };
}

function normaliseSession(s: Session): Session {
  return {
    ...s,
    teams: s.teams.map(normaliseTeam),
    brainstormResponses: s.brainstormResponses ?? [],
    hiddenBrainstormIds: s.hiddenBrainstormIds ?? [],
    practiceCredos: s.practiceCredos ?? {},
    practiceCompleted: s.practiceCompleted ?? false,
  };
}

export function reduce(rawSession: Session, action: Action): Session {
  const session = normaliseSession(rawSession);
  switch (action.type) {
    case 'SESSION_INIT':
      // do not wipe an in-flight session on facilitator reconnect.
      if (session.participants.length > 0 || session.startedAt) return session;
      return initialSession(action.sessionId, action.facilitatorId);

    case 'SESSION_START': {
      const now = Date.now();
      return pushEvent(
        {
          ...session,
          startedAt: now,
          actStartedAt: now,
        },
        event('actAdvanced', { to: 'arrival' }, now),
      );
    }

    case 'PARTICIPANT_JOIN': {
      if (session.participants.some((p) => p.id === action.participant.id)) {
        return {
          ...session,
          participants: session.participants.map((p) =>
            p.id === action.participant.id ? { ...p, lastSeenAt: Date.now() } : p,
          ),
        };
      }
      // late joiner after teams are formed: auto-assign to the smallest team
      // so they don't get stranded on "waiting for a team assignment".
      let participant = action.participant;
      if (session.teams.length > 0 && !participant.teamId) {
        const counts = new Map<string, number>(
          session.teams.map((t) => [t.id, 0] as [string, number]),
        );
        for (const p of session.participants) {
          if (p.teamId && counts.has(p.teamId)) {
            counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
          }
        }
        let smallestId = session.teams[0]!.id;
        let smallestCount = counts.get(smallestId) ?? 0;
        for (const [id, count] of counts) {
          if (count < smallestCount) {
            smallestId = id;
            smallestCount = count;
          }
        }
        participant = { ...participant, teamId: smallestId };
      }
      return pushEvent(
        {
          ...session,
          participants: [...session.participants, participant],
        },
        event('participantJoined', {
          id: participant.id,
          name: participant.displayName,
          teamId: participant.teamId,
        }),
      );
    }

    case 'PARTICIPANT_SEEN':
      return {
        ...session,
        participants: session.participants.map((p) =>
          p.id === action.participantId ? { ...p, lastSeenAt: action.at } : p,
        ),
      };

    case 'ARCHETYPE_SELECT':
      return pushEvent(
        {
          ...session,
          participants: session.participants.map((p) =>
            p.id === action.participantId ? { ...p, archetype: action.archetype } : p,
          ),
        },
        event('archetypeSelected', {
          participantId: action.participantId,
          archetype: action.archetype,
        }),
      );

    case 'PARTICIPANT_READY':
      return {
        ...session,
        participants: session.participants.map((p) =>
          p.id === action.participantId ? { ...p, ready: action.ready } : p,
        ),
      };

    case 'TEAMS_FORM': {
      const teams = action.teams.map(normaliseTeam);
      return pushEvent(
        {
          ...session,
          teams,
          participants: session.participants.map((p) => {
            const teamId = action.assignments[p.id];
            return teamId ? { ...p, teamId } : p;
          }),
        },
        event('teamJoined', { teams: teams.map((t) => t.id) }),
      );
    }

    case 'ACT_ADVANCE': {
      const act = getAct(action.to);
      // when entering practice, seed practice credits if not already seeded.
      const seedPractice =
        action.to === 'practice' && Object.keys(session.practiceCredos).length === 0;
      const practiceCredos = seedPractice
        ? Object.fromEntries(session.teams.map((t) => [t.id, PRACTICE_CREDOS]))
        : session.practiceCredos;
      // leaving practice → tear down practice auction state.
      const practiceAuction =
        action.to === 'practice' ? session.practiceAuction : undefined;
      return pushEvent(
        {
          ...session,
          currentAct: action.to,
          actStartedAt: action.at,
          actDurationMs: act.durationMs,
          // only carry currentAuction into auction-style acts.
          currentAuction:
            action.to === 'auction' || action.to === 'practice'
              ? session.currentAuction
              : undefined,
          practiceAuction,
          practiceCredos,
          // ready is per-act; reset it when the act changes.
          participants: session.participants.map((p) =>
            p.ready ? { ...p, ready: false } : p,
          ),
        },
        event('actAdvanced', { to: action.to }, action.at),
      );
    }

    case 'ACT_EXTEND':
      return pushEvent(
        { ...session, actDurationMs: session.actDurationMs + action.addMs },
        event('facilitatorExtended', { addMs: action.addMs }),
      );

    case 'INTENTION_SET': {
      return pushEvent(
        {
          ...session,
          teams: session.teams.map((t) =>
            t.id === action.teamId
              ? { ...t, intentions: { ...t.intentions, [action.valueId]: action.zone } }
              : t,
          ),
        },
        event('intentionSet', {
          teamId: action.teamId,
          valueId: action.valueId,
          zone: action.zone,
        }),
      );
    }

    case 'CEILING_SET': {
      const amount = Math.max(0, Math.min(STARTING_CREDOS, Math.round(action.amount)));
      return pushEvent(
        {
          ...session,
          teams: session.teams.map((t) =>
            t.id === action.teamId
              ? { ...t, softCeilings: { ...t.softCeilings, [action.valueId]: amount } }
              : t,
          ),
        },
        event('ceilingSet', {
          teamId: action.teamId,
          valueId: action.valueId,
          amount,
        }),
      );
    }

    case 'AUCTION_START': {
      const auction: Auction = {
        valueId: action.valueId,
        startedAt: action.at,
        durationMs: action.durationMs,
        lockedIn: false,
      };
      return pushEvent(
        { ...session, currentAuction: auction },
        event('auctionStarted', { valueId: action.valueId }, action.at),
      );
    }

    case 'BID_PLACE': {
      if (!session.currentAuction || session.currentAuction.lockedIn) {
        return pushEvent(
          session,
          event('bidRejected', {
            teamId: action.teamId,
            amount: action.amount,
            reason: 'no-auction',
          }),
        );
      }
      const team = session.teams.find((t) => t.id === action.teamId);
      if (!team) return session;
      if (session.mutedTeamIds.includes(team.id)) {
        return pushEvent(
          session,
          event('bidRejected', {
            teamId: team.id,
            amount: action.amount,
            reason: 'muted',
          }),
        );
      }
      const currentHigh = session.currentAuction.highBid?.amount ?? 0;
      if (action.amount <= currentHigh) {
        return pushEvent(
          session,
          event('bidRejected', {
            teamId: team.id,
            amount: action.amount,
            reason: 'below-high',
          }),
        );
      }
      const practice = isPracticeAuction(session);
      const budget = practice
        ? (session.practiceCredos[team.id] ?? PRACTICE_CREDOS)
        : team.credos;
      if (action.amount > budget) {
        return pushEvent(
          session,
          event('bidRejected', {
            teamId: team.id,
            amount: action.amount,
            reason: 'insufficient-credos',
          }),
        );
      }
      return pushEvent(
        {
          ...session,
          currentAuction: {
            ...session.currentAuction,
            highBid: { teamId: team.id, amount: action.amount, at: action.at },
          },
        },
        event(
          'bidPlaced',
          {
            teamId: team.id,
            amount: action.amount,
            valueId: session.currentAuction.valueId,
            practice,
          },
          action.at,
        ),
      );
    }

    case 'AUCTION_END': {
      if (!session.currentAuction) return session;
      const auction = session.currentAuction;
      if (auction.lockedIn) return session;
      const winnerId = auction.highBid?.teamId;
      const winAmount = auction.highBid?.amount ?? 0;
      const practice = Boolean(auction.practice);
      const locked: Auction = {
        ...auction,
        lockedIn: true,
        winnerTeamId: winnerId,
      };
      if (practice) {
        // practice winners don't earn the value or spend real credos. we
        // do deduct from the disposable practice balance so the running
        // total feels real during the rehearsal.
        const nextPracticeCredos = { ...session.practiceCredos };
        if (winnerId) {
          const before = nextPracticeCredos[winnerId] ?? PRACTICE_CREDOS;
          nextPracticeCredos[winnerId] = Math.max(0, before - winAmount);
        }
        return pushEvent(
          {
            ...session,
            currentAuction: undefined,
            practiceAuction: locked,
            practiceCredos: nextPracticeCredos,
            practiceCompleted: true,
          },
          event(
            'practiceEnded',
            { winnerTeamId: winnerId, amount: winAmount },
            action.at,
          ),
        );
      }
      const teams = winnerId
        ? session.teams.map((t) =>
            t.id === winnerId
              ? {
                  ...t,
                  credos: Math.max(0, t.credos - winAmount),
                  wonValues: [...t.wonValues, auction.valueId],
                  // a value that's been won is no longer a planning target.
                  lockedBids: stripKey(t.lockedBids, auction.valueId),
                }
              : t,
          )
        : session.teams;
      return pushEvent(
        {
          ...session,
          currentAuction: undefined,
          completedAuctions: [...session.completedAuctions, locked],
          valueDeck: session.valueDeck.filter((id) => id !== auction.valueId),
          teams,
        },
        event(
          'valueLocked',
          {
            valueId: auction.valueId,
            winnerTeamId: winnerId,
            amount: winAmount,
          },
          action.at,
        ),
      );
    }

    case 'PURPOSE_WRITE':
      return pushEvent(
        {
          ...session,
          teams: session.teams.map((t) =>
            t.id === action.teamId ? { ...t, purposeStatement: action.statement } : t,
          ),
        },
        event('purposeWritten', {
          teamId: action.teamId,
          length: action.statement.length,
        }),
      );

    case 'REFLECTION_ANSWER':
      return {
        ...session,
        teams: session.teams.map((t) => {
          if (t.id !== action.teamId) return t;
          const answers = [...t.reflectionAnswers];
          answers[action.index] = action.answer;
          return { ...t, reflectionAnswers: answers };
        }),
      };

    case 'BROADCAST':
      return pushEvent(
        {
          ...session,
          broadcasts: [
            ...session.broadcasts,
            { id: uid('bc'), at: action.at, message: action.message },
          ],
        },
        event('facilitatorBroadcast', { message: action.message }, action.at),
      );

    case 'MUTE_TEAM':
      return pushEvent(
        {
          ...session,
          mutedTeamIds: action.muted
            ? Array.from(new Set([...session.mutedTeamIds, action.teamId]))
            : session.mutedTeamIds.filter((id) => id !== action.teamId),
        },
        event('facilitatorOverride', {
          action: action.muted ? 'mute' : 'unmute',
          teamId: action.teamId,
        }),
      );

    case 'RESET_CURRENT_BID': {
      if (!session.currentAuction) return session;
      return pushEvent(
        {
          ...session,
          currentAuction: { ...session.currentAuction, highBid: undefined },
        },
        event('facilitatorOverride', { action: 'reset-bid' }, action.at),
      );
    }

    case 'REFUND_CREDOS':
      return pushEvent(
        {
          ...session,
          teams: session.teams.map((t) =>
            t.id === action.teamId
              ? { ...t, credos: Math.max(0, t.credos + action.amount) }
              : t,
          ),
        },
        event(
          'facilitatorOverride',
          { action: 'refund', teamId: action.teamId, amount: action.amount },
          action.at,
        ),
      );

    case 'BRAINSTORM_SUBMIT': {
      const text = action.text.trim().slice(0, BRAINSTORM_MAX_LEN);
      if (!text) return session;
      const already = session.participants.find(
        (p) => p.id === action.participantId,
      )?.brainstormSubmitted;
      if (already) return session;
      return pushEvent(
        {
          ...session,
          brainstormResponses: [
            ...session.brainstormResponses,
            { id: uid('br'), participantId: action.participantId, at: action.at, text },
          ],
          participants: session.participants.map((p) =>
            p.id === action.participantId ? { ...p, brainstormSubmitted: true } : p,
          ),
        },
        event(
          'brainstormSubmitted',
          { participantId: action.participantId, length: text.length },
          action.at,
        ),
      );
    }

    case 'BRAINSTORM_HIDE':
      return pushEvent(
        {
          ...session,
          hiddenBrainstormIds: Array.from(
            new Set([...session.hiddenBrainstormIds, action.responseId]),
          ),
        },
        event('brainstormHidden', { responseId: action.responseId }),
      );

    case 'POLL_VOTE': {
      const amount = Math.max(0, Math.round(action.amount));
      return pushEvent(
        {
          ...session,
          teams: session.teams.map((t) => {
            if (t.id !== action.teamId) return t;
            const existing = t.polls[action.valueId] ?? {};
            return {
              ...t,
              polls: {
                ...t.polls,
                [action.valueId]: { ...existing, [action.participantId]: amount },
              },
            };
          }),
        },
        event('pollVoted', {
          teamId: action.teamId,
          valueId: action.valueId,
          participantId: action.participantId,
          amount,
        }),
      );
    }

    case 'BID_LOCK': {
      const amount = Math.max(0, Math.min(STARTING_CREDOS, Math.round(action.amount)));
      return pushEvent(
        {
          ...session,
          teams: session.teams.map((t) =>
            t.id === action.teamId
              ? { ...t, lockedBids: { ...t.lockedBids, [action.valueId]: amount } }
              : t,
          ),
        },
        event('bidLocked', {
          teamId: action.teamId,
          valueId: action.valueId,
          amount,
        }),
      );
    }

    case 'BID_UNLOCK': {
      return pushEvent(
        {
          ...session,
          teams: session.teams.map((t) =>
            t.id === action.teamId
              ? { ...t, lockedBids: stripKey(t.lockedBids, action.valueId) }
              : t,
          ),
        },
        event('bidUnlocked', { teamId: action.teamId, valueId: action.valueId }),
      );
    }

    case 'CAPTAIN_CLAIM': {
      const team = session.teams.find((t) => t.id === action.teamId);
      if (!team) return session;
      // first-claim-wins: ignore subsequent claims unless there is no captain.
      if (team.captainParticipantId && team.captainParticipantId !== action.participantId)
        return session;
      return pushEvent(
        {
          ...session,
          teams: session.teams.map((t) =>
            t.id === team.id
              ? {
                  ...t,
                  captainParticipantId: action.participantId,
                  captainGraceStartedAt: undefined,
                }
              : t,
          ),
        },
        event(
          'captainClaimed',
          { teamId: team.id, participantId: action.participantId },
          action.at,
        ),
      );
    }

    case 'CAPTAIN_PASS': {
      return pushEvent(
        {
          ...session,
          teams: session.teams.map((t) =>
            t.id === action.teamId
              ? {
                  ...t,
                  captainParticipantId: action.toParticipantId,
                  captainGraceStartedAt: undefined,
                }
              : t,
          ),
        },
        event(
          'captainTransferred',
          { teamId: action.teamId, to: action.toParticipantId, reason: 'manual' },
          action.at,
        ),
      );
    }

    case 'CAPTAIN_AUTO_TRANSFER': {
      return pushEvent(
        {
          ...session,
          teams: session.teams.map((t) =>
            t.id === action.teamId
              ? {
                  ...t,
                  captainParticipantId: action.newCaptainId,
                  captainGraceStartedAt: undefined,
                }
              : t,
          ),
        },
        event(
          'captainTransferred',
          {
            teamId: action.teamId,
            to: action.newCaptainId,
            reason: action.reason,
          },
          action.at,
        ),
      );
    }

    case 'PRACTICE_START': {
      // the practice value is a synthetic id — never in the real deck.
      const auction: Auction = {
        valueId: PRACTICE_VALUE_ID,
        startedAt: action.at,
        durationMs: action.durationMs,
        lockedIn: false,
        practice: true,
      };
      return pushEvent(
        { ...session, currentAuction: auction },
        event('practiceStarted', {}, action.at),
      );
    }

    case 'PRACTICE_END': {
      if (!session.currentAuction?.practice) return session;
      // delegate to AUCTION_END so the bid mechanic is identical.
      return reduce(session, { type: 'AUCTION_END', at: action.at });
    }
  }
}

function stripKey<V>(obj: Record<string, V>, key: string): Record<string, V> {
  if (!(key in obj)) return obj;
  const next: Record<string, V> = {};
  for (const k of Object.keys(obj)) if (k !== key) next[k] = obj[k]!;
  return next;
}

export function assignTeams(
  participants: Array<{ id: string; archetype?: string }>,
  teamSize = 4,
): { teams: Team[]; assignments: Record<string, string> } {
  const count = Math.max(1, Math.ceil(participants.length / teamSize));
  const assignments: Record<string, string> = {};
  const teams: Team[] = [];
  const sorted = [...participants].sort((a, b) => {
    const order = ['builder', 'diplomat', 'rebel', 'steward'];
    const ai = order.indexOf(a.archetype ?? 'builder');
    const bi = order.indexOf(b.archetype ?? 'builder');
    return ai - bi;
  });

  for (let i = 0; i < count; i++) {
    const colour = TEAM_COLOURS[i % TEAM_COLOURS.length]!;
    const startup = STARTUPS[i % STARTUPS.length]!;
    const teamId = uid('team');
    teams.push({
      id: teamId,
      name: teamDisplayName(colour),
      colour,
      startupId: startup.id,
      credos: STARTING_CREDOS,
      intentions: {},
      softCeilings: {},
      wonValues: [],
      reflectionAnswers: [],
      polls: {},
      lockedBids: {},
    });
  }

  sorted.forEach((p, idx) => {
    const team = teams[idx % teams.length]!;
    assignments[p.id] = team.id;
  });

  return { teams, assignments };
}

export function advanceAct(session: Session): Action | null {
  const next = nextAct(session.currentAct);
  if (!next) return null;
  return { type: 'ACT_ADVANCE', to: next, at: Date.now() };
}

// re-export so views can use these without pulling from types directly
export { PRACTICE_CREDOS, PRACTICE_VALUE_ID } from '@/state/types';
// avoid unused-import warning when only Participant type is needed elsewhere
export type { Participant };
