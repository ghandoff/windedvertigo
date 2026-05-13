import type { ActId } from '@/state/types';

export type ActSurface = 'cadet' | 'seafoam' | 'sienna';

export interface ActDefinition {
  id: ActId;
  index: number;
  name: string;
  durationMs: number;
  mode: 'plenary' | 'team' | 'plenary-team';
  tempo: 'calm' | 'snappy';
  surface: ActSurface;
  description: string;
}

export const ACTS: ActDefinition[] = [
  {
    id: 'arrival',
    index: 0,
    name: 'arrival',
    durationMs: 3 * 60_000,
    mode: 'plenary',
    tempo: 'calm',
    surface: 'cadet',
    description: 'participants join and settle in.',
  },
  {
    id: 'grouping',
    index: 1,
    name: 'grouping',
    durationMs: 3 * 60_000,
    mode: 'plenary-team',
    tempo: 'calm',
    surface: 'cadet',
    description: 'archetype sort → teams assigned.',
  },
  {
    id: 'scene',
    index: 2,
    name: 'set the scene',
    durationMs: 4 * 60_000,
    mode: 'team',
    tempo: 'calm',
    surface: 'cadet',
    description: 'each team receives their startup and challenge.',
  },
  {
    id: 'brainstorm',
    index: 3,
    name: 'brainstorm',
    durationMs: 4 * 60_000,
    mode: 'plenary',
    tempo: 'calm',
    surface: 'seafoam',
    description: 'open text wall. one submission per participant, fully anonymous.',
  },
  {
    id: 'strategy',
    index: 4,
    name: 'team strategy',
    durationMs: 15 * 60_000,
    mode: 'team',
    tempo: 'calm',
    surface: 'seafoam',
    description: 'agree on intentions, vote per-value, claim a bid captain.',
  },
  {
    id: 'practice',
    index: 5,
    name: 'practice round',
    durationMs: 3 * 60_000,
    mode: 'plenary',
    tempo: 'snappy',
    surface: 'sienna',
    description: 'dummy value, separate practice credits. learn the mechanic.',
  },
  {
    id: 'auction',
    index: 6,
    name: 'auction',
    durationMs: 10 * 60_000,
    mode: 'plenary',
    tempo: 'snappy',
    surface: 'sienna',
    description: 'live bidding. losses are final.',
  },
  {
    id: 'restrategize',
    index: 7,
    name: 'restrategize',
    durationMs: 4 * 60_000,
    mode: 'team',
    tempo: 'calm',
    surface: 'seafoam',
    description: 'mid-auction break — revise bids with results and competition visible.',
  },
  {
    id: 'auction-2',
    index: 8,
    name: 'auction (round 2)',
    durationMs: 10 * 60_000,
    mode: 'plenary',
    tempo: 'snappy',
    surface: 'sienna',
    description: 'second auction round with remaining values.',
  },
  {
    id: 'reflection',
    index: 9,
    name: 'reflection',
    durationMs: 5 * 60_000,
    mode: 'team',
    tempo: 'calm',
    surface: 'cadet',
    description: 'four prompts, one purpose statement.',
  },
  {
    id: 'regather',
    index: 10,
    name: 'regather',
    durationMs: 5 * 60_000,
    mode: 'plenary',
    tempo: 'calm',
    surface: 'cadet',
    description: 'share identity cards, debrief.',
  },
];

export function getAct(id: ActId): ActDefinition {
  const act = ACTS.find((a) => a.id === id);
  if (!act) throw new Error(`unknown act: ${id}`);
  return act;
}

export function nextAct(id: ActId): ActId | null {
  const current = getAct(id);
  const next = ACTS[current.index + 1];
  return next ? next.id : null;
}

export function prevAct(id: ActId): ActId | null {
  const current = getAct(id);
  const prev = ACTS[current.index - 1];
  return prev ? prev.id : null;
}
