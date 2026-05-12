import { describe, it, expect } from 'vitest';
import {
  initialSession,
  reduce,
  STARTING_CREDOS,
  DEFAULT_AUCTION_MS,
  assignTeams,
} from '@/state/reducers';
import type { Session, Team } from '@/state/types';

function seedTeams(session: Session, count = 2): Session {
  const teams: Team[] = [];
  for (let i = 0; i < count; i++) {
    teams.push({
      id: `team_${i}`,
      name: `team ${i}`,
      colour: i === 0 ? 'cadet' : 'redwood',
      startupId: 'ethos',
      credos: STARTING_CREDOS,
      intentions: {},
      softCeilings: {},
      wonValues: [],
      reflectionAnswers: [],
      polls: {},
      lockedBids: {},
    });
  }
  return reduce(session, { type: 'TEAMS_FORM', teams, assignments: {} });
}

describe('reducers', () => {
  it('initial session starts in arrival with full value deck', () => {
    const s = initialSession('T', 'fac');
    expect(s.currentAct).toBe('arrival');
    expect(s.valueDeck.length).toBe(20);
    expect(s.teams).toHaveLength(0);
  });

  it('act advance resets timing', () => {
    let s = initialSession('T', 'fac');
    s = reduce(s, { type: 'ACT_ADVANCE', to: 'scene', at: 1000 });
    expect(s.currentAct).toBe('scene');
    expect(s.actStartedAt).toBe(1000);
  });

  it('bid rejected when no auction is live', () => {
    let s = initialSession('T', 'fac');
    s = seedTeams(s);
    const before = s.events.length;
    s = reduce(s, {
      type: 'BID_PLACE',
      teamId: 'team_0',
      amount: 10,
      at: 1,
    });
    const lastEvent = s.events[s.events.length - 1];
    expect(lastEvent?.type).toBe('bidRejected');
    expect(s.events.length).toBe(before + 1);
  });

  it('bid rejected when below or equal to current high', () => {
    let s = initialSession('T', 'fac');
    s = seedTeams(s);
    s = reduce(s, {
      type: 'AUCTION_START',
      valueId: 'radical-transparency',
      durationMs: DEFAULT_AUCTION_MS,
      at: 0,
    });
    s = reduce(s, { type: 'BID_PLACE', teamId: 'team_0', amount: 10, at: 1 });
    s = reduce(s, { type: 'BID_PLACE', teamId: 'team_1', amount: 10, at: 2 });
    expect(s.currentAuction?.highBid?.amount).toBe(10);
    expect(s.currentAuction?.highBid?.teamId).toBe('team_0');
  });

  it('bid rejected when exceeds remaining credos', () => {
    let s = initialSession('T', 'fac');
    s = seedTeams(s);
    s = reduce(s, {
      type: 'AUCTION_START',
      valueId: 'radical-transparency',
      durationMs: DEFAULT_AUCTION_MS,
      at: 0,
    });
    s = reduce(s, {
      type: 'BID_PLACE',
      teamId: 'team_0',
      amount: STARTING_CREDOS + 1,
      at: 1,
    });
    expect(s.currentAuction?.highBid).toBeUndefined();
    expect(s.events[s.events.length - 1]?.type).toBe('bidRejected');
  });

  it('auction end locks in winner and deducts credos from only that team', () => {
    let s = initialSession('T', 'fac');
    s = seedTeams(s);
    s = reduce(s, {
      type: 'AUCTION_START',
      valueId: 'equity-inclusion',
      durationMs: DEFAULT_AUCTION_MS,
      at: 0,
    });
    s = reduce(s, { type: 'BID_PLACE', teamId: 'team_0', amount: 25, at: 1 });
    s = reduce(s, { type: 'BID_PLACE', teamId: 'team_1', amount: 40, at: 2 });
    s = reduce(s, { type: 'AUCTION_END', at: 3 });
    const winner = s.teams.find((t) => t.id === 'team_1')!;
    const loser = s.teams.find((t) => t.id === 'team_0')!;
    expect(winner.credos).toBe(STARTING_CREDOS - 40);
    expect(loser.credos).toBe(STARTING_CREDOS);
    expect(winner.wonValues).toContain('equity-inclusion');
    expect(s.valueDeck).not.toContain('equity-inclusion');
    expect(s.currentAuction).toBeUndefined();
  });

  it('credos never go negative even with facilitator refund misuse', () => {
    let s = initialSession('T', 'fac');
    s = seedTeams(s);
    s = reduce(s, {
      type: 'REFUND_CREDOS',
      teamId: 'team_0',
      amount: -1000,
      at: 0,
    });
    expect(s.teams[0]!.credos).toBeGreaterThanOrEqual(0);
  });

  it('assignTeams distributes participants across teams', () => {
    const participants = Array.from({ length: 8 }, (_, i) => ({
      id: `p_${i}`,
      archetype: i % 2 === 0 ? 'builder' : 'rebel',
    }));
    const { teams, assignments } = assignTeams(participants, 4);
    expect(teams).toHaveLength(2);
    expect(Object.keys(assignments)).toHaveLength(8);
  });

  it('broadcast appends to session broadcasts and events', () => {
    let s = initialSession('T', 'fac');
    s = reduce(s, { type: 'BROADCAST', message: 'hello room', at: 42 });
    expect(s.broadcasts).toHaveLength(1);
    expect(s.broadcasts[0]!.message).toBe('hello room');
    expect(s.events[s.events.length - 1]?.type).toBe('facilitatorBroadcast');
  });

  it('brainstorm submission is single-use per participant and capped to 80 chars', () => {
    let s = initialSession('T', 'fac');
    s = reduce(s, {
      type: 'PARTICIPANT_JOIN',
      participant: {
        id: 'p_1',
        displayName: 'a',
        teamId: null,
        joinedAt: 0,
        lastSeenAt: 0,
        role: 'participant',
      },
    });
    const longText = 'a'.repeat(200);
    s = reduce(s, {
      type: 'BRAINSTORM_SUBMIT',
      participantId: 'p_1',
      text: longText,
      at: 1,
    });
    expect(s.brainstormResponses).toHaveLength(1);
    expect(s.brainstormResponses[0]!.text.length).toBeLessThanOrEqual(80);
    // duplicate submission ignored
    s = reduce(s, {
      type: 'BRAINSTORM_SUBMIT',
      participantId: 'p_1',
      text: 'second go',
      at: 2,
    });
    expect(s.brainstormResponses).toHaveLength(1);
  });

  it('captain claim is first-write-wins; subsequent claims are ignored', () => {
    let s = initialSession('T', 'fac');
    s = seedTeams(s);
    s = reduce(s, {
      type: 'CAPTAIN_CLAIM',
      teamId: 'team_0',
      participantId: 'p_first',
      at: 1,
    });
    expect(s.teams[0]!.captainParticipantId).toBe('p_first');
    s = reduce(s, {
      type: 'CAPTAIN_CLAIM',
      teamId: 'team_0',
      participantId: 'p_second',
      at: 2,
    });
    expect(s.teams[0]!.captainParticipantId).toBe('p_first');
    // explicit pass works
    s = reduce(s, {
      type: 'CAPTAIN_PASS',
      teamId: 'team_0',
      toParticipantId: 'p_second',
      at: 3,
    });
    expect(s.teams[0]!.captainParticipantId).toBe('p_second');
  });

  it('poll vote captures per-participant amount and overwrites on revote', () => {
    let s = initialSession('T', 'fac');
    s = seedTeams(s);
    s = reduce(s, {
      type: 'POLL_VOTE',
      teamId: 'team_0',
      valueId: 'radical-transparency',
      participantId: 'p_1',
      amount: 40,
    });
    s = reduce(s, {
      type: 'POLL_VOTE',
      teamId: 'team_0',
      valueId: 'radical-transparency',
      participantId: 'p_1',
      amount: 60,
    });
    expect(s.teams[0]!.polls['radical-transparency']?.p_1).toBe(60);
  });

  it('bid lock/unlock and AUCTION_END strips locked bid for won value', () => {
    let s = initialSession('T', 'fac');
    s = seedTeams(s);
    s = reduce(s, {
      type: 'BID_LOCK',
      teamId: 'team_0',
      valueId: 'equity-inclusion',
      amount: 50,
    });
    expect(s.teams[0]!.lockedBids['equity-inclusion']).toBe(50);
    s = reduce(s, {
      type: 'AUCTION_START',
      valueId: 'equity-inclusion',
      durationMs: DEFAULT_AUCTION_MS,
      at: 0,
    });
    s = reduce(s, { type: 'BID_PLACE', teamId: 'team_0', amount: 50, at: 1 });
    s = reduce(s, { type: 'AUCTION_END', at: 2 });
    const winner = s.teams.find((t) => t.id === 'team_0')!;
    expect(winner.wonValues).toContain('equity-inclusion');
    expect('equity-inclusion' in winner.lockedBids).toBe(false);
  });

  it('practice round does not deduct real credos or add to wonValues', () => {
    let s = initialSession('T', 'fac');
    s = seedTeams(s);
    s = reduce(s, { type: 'ACT_ADVANCE', to: 'practice', at: 0 });
    s = reduce(s, { type: 'PRACTICE_START', durationMs: 30_000, at: 0 });
    s = reduce(s, { type: 'BID_PLACE', teamId: 'team_0', amount: 30, at: 1 });
    s = reduce(s, { type: 'PRACTICE_END', at: 2 });
    const team = s.teams.find((t) => t.id === 'team_0')!;
    expect(team.credos).toBe(STARTING_CREDOS);
    expect(team.wonValues).toHaveLength(0);
    expect(s.practiceCompleted).toBe(true);
    expect(s.practiceCredos.team_0).toBe(50 - 30);
  });
});
