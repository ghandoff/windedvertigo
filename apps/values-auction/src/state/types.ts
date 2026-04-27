export type ActId =
  | 'arrival'
  | 'grouping'
  | 'scene'
  | 'strategy'
  | 'auction'
  | 'reflection'
  | 'regather';

export type TeamColour = 'cadet' | 'redwood' | 'sienna' | 'champagne' | 'deep' | 'sand';

export type Archetype = 'builder' | 'diplomat' | 'rebel' | 'steward';

export type IntentionZone = 'must' | 'nice' | 'wont' | null;

export interface Session {
  id: string;
  createdAt: number;
  startedAt?: number;
  currentAct: ActId;
  actStartedAt?: number;
  actDurationMs: number;
  facilitatorId: string;
  teams: Team[];
  participants: Participant[];
  valueDeck: string[];
  currentAuction?: Auction;
  completedAuctions: Auction[];
  events: SessionEvent[];
  broadcasts: Broadcast[];
  mutedTeamIds: string[];
}

export interface Team {
  id: string;
  name: string;
  colour: TeamColour;
  startupId: string;
  credos: number;
  intentions: Record<string, IntentionZone>;
  softCeilings: Record<string, number>;
  wonValues: string[];
  purposeStatement?: string;
  reflectionAnswers: string[];
}

export interface Participant {
  id: string;
  displayName: string;
  teamId: string | null;
  joinedAt: number;
  lastSeenAt: number;
  archetype?: Archetype;
  ready?: boolean;
  role: 'participant' | 'facilitator' | 'wall';
}

export interface Auction {
  valueId: string;
  startedAt: number;
  durationMs: number;
  highBid?: { teamId: string; amount: number; at: number };
  lockedIn: boolean;
  winnerTeamId?: string;
}

export interface Broadcast {
  id: string;
  at: number;
  message: string;
}

export interface SessionEvent {
  id: string;
  at: number;
  type:
    | 'actAdvanced'
    | 'bidPlaced'
    | 'bidRejected'
    | 'valueLocked'
    | 'teamJoined'
    | 'participantJoined'
    | 'archetypeSelected'
    | 'purposeWritten'
    | 'intentionSet'
    | 'ceilingSet'
    | 'auctionStarted'
    | 'auctionEnded'
    | 'facilitatorPaused'
    | 'facilitatorExtended'
    | 'facilitatorBroadcast'
    | 'facilitatorOverride';
  payload: Record<string, unknown>;
}

export type Action =
  | { type: 'SESSION_INIT'; sessionId: string; facilitatorId: string }
  | { type: 'SESSION_START' }
  | { type: 'PARTICIPANT_JOIN'; participant: Participant }
  | { type: 'PARTICIPANT_SEEN'; participantId: string; at: number }
  | { type: 'ARCHETYPE_SELECT'; participantId: string; archetype: Archetype }
  | { type: 'PARTICIPANT_READY'; participantId: string; ready: boolean }
  | { type: 'TEAMS_FORM'; teams: Team[]; assignments: Record<string, string> }
  | { type: 'ACT_ADVANCE'; to: ActId; at: number }
  | { type: 'ACT_EXTEND'; addMs: number }
  | { type: 'INTENTION_SET'; teamId: string; valueId: string; zone: IntentionZone }
  | { type: 'CEILING_SET'; teamId: string; valueId: string; amount: number }
  | { type: 'AUCTION_START'; valueId: string; durationMs: number; at: number }
  | { type: 'BID_PLACE'; teamId: string; amount: number; at: number }
  | { type: 'AUCTION_END'; at: number }
  | { type: 'PURPOSE_WRITE'; teamId: string; statement: string }
  | { type: 'REFLECTION_ANSWER'; teamId: string; index: number; answer: string }
  | { type: 'BROADCAST'; message: string; at: number }
  | { type: 'MUTE_TEAM'; teamId: string; muted: boolean }
  | { type: 'RESET_CURRENT_BID'; at: number }
  | { type: 'REFUND_CREDOS'; teamId: string; amount: number; at: number };
