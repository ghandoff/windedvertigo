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
});
