/**
 * 300-user smoke test.
 *
 * Verifies:
 * 1. assignTeams creates exactly one team per startup (8 teams for 300 participants).
 * 2. Each startup gets exactly one team; all 8 companies present.
 * 3. Brainstorm responses are filtered to same-team only (no cross-team leakage).
 * 4. Planned spend updates correctly when captain locks bids.
 */

import { describe, it, expect } from 'vitest';
import { assignTeams, initialSession, reduce, STARTING_CREDOS } from '../src/state/reducers';
import { visibleBrainstorm, plannedSpend } from '../src/state/selectors';
import type { Session } from '../src/state/types';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeParticipants(count: number) {
  const archetypes = ['builder', 'diplomat', 'rebel', 'steward'] as const;
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    archetype: archetypes[i % 4],
  }));
}

function seedSession(participantCount: number): Session {
  let s = initialSession('test-session', 'facilitator-0');
  const participants = makeParticipants(participantCount);

  // join all participants
  for (const p of participants) {
    s = reduce(s, {
      type: 'PARTICIPANT_JOIN',
      participant: {
        id: p.id,
        displayName: `User ${p.id}`,
        teamId: null,
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
        role: 'participant',
        archetype: p.archetype,
      },
    });
  }

  // form teams
  const { teams, assignments } = assignTeams(participants);
  s = reduce(s, { type: 'TEAMS_FORM', teams, assignments });
  return s;
}

// ---------------------------------------------------------------------------
// 1. Team distribution with 300 users
// ---------------------------------------------------------------------------

describe('300-user smoke: team distribution', () => {
  it('creates exactly 8 teams (one per startup) and distributes 300 participants across them', () => {
    const s = seedSession(300);

    // one team per startup
    expect(s.teams).toHaveLength(8);

    const counts = s.teams.map((t) => {
      const members = s.participants.filter((p) => p.teamId === t.id);
      return { teamId: t.id, name: t.name, startup: t.startupId, count: members.length };
    });

    // report distribution (vitest captures this in --reporter=verbose)
    console.log('\n--- 300-user team distribution ---');
    for (const c of counts) {
      console.log(`  ${c.startup}: ${c.count} members`);
    }
    console.log(`  total teams: ${counts.length}, total participants: 300`);
    console.log(`  min per team: ${Math.min(...counts.map((c) => c.count))}`);
    console.log(`  max per team: ${Math.max(...counts.map((c) => c.count))}`);

    const sizes = counts.map((c) => c.count);
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);

    // 300 / 8 = 37.5 → teams 0-3 get 38, teams 4-7 get 37
    expect(min).toBe(37);
    expect(max).toBe(38);

    // every participant is assigned
    const assigned = s.participants.filter((p) => p.role === 'participant' && p.teamId !== null);
    expect(assigned).toHaveLength(300);
  });

  it('assigns each startup to exactly one team', () => {
    const s = seedSession(300);
    const startupIds = s.teams.map((t) => t.startupId);
    // 8 teams, 8 startups — each appears exactly once
    expect(new Set(startupIds).size).toBe(8);
    expect(startupIds).toHaveLength(8);
  });

  it('assigns at least some team per archetype bucket', () => {
    const s = seedSession(300);
    // each team should have all 4 archetypes represented (300 / 4 archetypes / 75 teams = 1 each)
    for (const team of s.teams) {
      const members = s.participants.filter((p) => p.teamId === team.id);
      const archetypes = new Set(members.map((p) => p.archetype));
      expect(archetypes.size).toBe(4);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Brainstorm filtering: only same-team responses visible
// ---------------------------------------------------------------------------

describe('300-user smoke: brainstorm team isolation', () => {
  it('each participant only sees responses from their own team', () => {
    let s = seedSession(300);

    // submit brainstorm for first 40 participants (covering ~10 teams)
    for (let i = 0; i < 40; i++) {
      const p = s.participants.find((x) => x.id === `p${i}`)!;
      s = reduce(s, {
        type: 'BRAINSTORM_SUBMIT',
        participantId: p.id,
        teamId: p.teamId,
        text: `response from p${i}`,
        at: Date.now() + i,
      });
    }

    // pick a participant and verify they only see their own team's responses
    const testParticipant = s.participants.find((p) => p.id === 'p0')!;
    const teamId = testParticipant.teamId!;

    const teamResponses = visibleBrainstorm(s, teamId);
    const allResponses = visibleBrainstorm(s);

    // team responses should be a strict subset of all responses
    expect(teamResponses.length).toBeGreaterThan(0);
    expect(teamResponses.length).toBeLessThan(allResponses.length);

    // every response in team view belongs to this team
    for (const r of teamResponses) {
      expect(r.teamId).toBe(teamId);
    }
  });

  it('responses from different teams are not cross-visible', () => {
    let s = seedSession(8); // 8 teams, 1 participant each

    const team1Id = s.teams[0]!.id;
    const team2Id = s.teams[1]!.id;

    const p1 = s.participants.find((p) => p.teamId === team1Id)!;
    const p2 = s.participants.find((p) => p.teamId === team2Id)!;

    s = reduce(s, {
      type: 'BRAINSTORM_SUBMIT',
      participantId: p1.id,
      teamId: team1Id,
      text: 'team 1 idea',
      at: 1000,
    });

    s = reduce(s, {
      type: 'BRAINSTORM_SUBMIT',
      participantId: p2.id,
      teamId: team2Id,
      text: 'team 2 idea',
      at: 2000,
    });

    const team1View = visibleBrainstorm(s, team1Id);
    const team2View = visibleBrainstorm(s, team2Id);

    expect(team1View).toHaveLength(1);
    expect(team1View[0]!.text).toBe('team 1 idea');

    expect(team2View).toHaveLength(1);
    expect(team2View[0]!.text).toBe('team 2 idea');
  });
});

// ---------------------------------------------------------------------------
// 3. Planned spend updates when captain locks bids
// ---------------------------------------------------------------------------

describe('planned spend: updates correctly on lock', () => {
  it('reflects locked bids in planned spend', () => {
    let s = seedSession(4); // 8 teams, first 4 participants distributed across teams 0-3
    const team = s.teams[0]!;

    // initial planned spend is 0
    expect(plannedSpend(team)).toBe(0);

    // captain locks two values
    s = reduce(s, { type: 'BID_LOCK', teamId: team.id, valueId: 'accountability', amount: 40 });
    s = reduce(s, { type: 'BID_LOCK', teamId: team.id, valueId: 'courage', amount: 30 });

    const updatedTeam = s.teams.find((t) => t.id === team.id)!;
    expect(plannedSpend(updatedTeam)).toBe(70);
  });

  it('planned spend decreases when a bid is unlocked', () => {
    let s = seedSession(4);
    const team = s.teams[0]!;

    s = reduce(s, { type: 'BID_LOCK', teamId: team.id, valueId: 'accountability', amount: 40 });
    s = reduce(s, { type: 'BID_LOCK', teamId: team.id, valueId: 'courage', amount: 30 });
    s = reduce(s, { type: 'BID_UNLOCK', teamId: team.id, valueId: 'accountability' });

    const updatedTeam = s.teams.find((t) => t.id === team.id)!;
    expect(plannedSpend(updatedTeam)).toBe(30);
  });

  it('planned spend does not exceed starting credos', () => {
    let s = seedSession(4);
    const team = s.teams[0]!;

    // locking a value at more than STARTING_CREDOS should be clamped by reducer
    s = reduce(s, { type: 'BID_LOCK', teamId: team.id, valueId: 'accountability', amount: 9999 });
    const updatedTeam = s.teams.find((t) => t.id === team.id)!;
    expect(plannedSpend(updatedTeam)).toBeLessThanOrEqual(STARTING_CREDOS);
  });
});
