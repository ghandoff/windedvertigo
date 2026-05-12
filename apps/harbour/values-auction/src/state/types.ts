export type ActId =
  | 'arrival'
  | 'grouping'
  | 'scene'
  | 'brainstorm'
  | 'strategy'
  | 'practice'
  | 'auction'
  | 'restrategize'
  | 'reflection'
  | 'regather';

export type TeamColour = 'cadet' | 'redwood' | 'sienna' | 'champagne' | 'deep' | 'sand';

export type Archetype = 'builder' | 'diplomat' | 'rebel' | 'steward';

export type IntentionZone = 'must' | 'nice' | 'wont' | null;

/**
 * fixed-step bid amounts for the team consensus poll. mirrors the spec:
 * skip / low / mid / high / all-in.
 */
export const POLL_AMOUNTS = [0, 20, 40, 60, 80] as const;
export type PollAmount = (typeof POLL_AMOUNTS)[number];

export const PRACTICE_CREDOS = 50;
export const PRACTICE_VALUE_ID = '__practice__';

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
  /**
   * brainstorm-wall responses. anonymous from the participant's view —
   * we keep the participantId server-side for deduping and rate-limiting,
   * but it is never rendered.
   */
  brainstormResponses: BrainstormResponse[];
  hiddenBrainstormIds: string[];
  /**
   * practice round state. lives separately from real currentAuction so the
   * reducer never confuses practice credits with real credos.
   */
  practiceAuction?: Auction;
  practiceCredos: Record<string, number>;
  practiceCompleted: boolean;
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
  /**
   * per-value team poll votes — keyed by valueId, then by participantId.
   * captures the live "should we bid X?" sentiment during team strategy.
   */
  polls: Record<string, Record<string, number>>;
  /**
   * captain-locked bid amount per value. when a value comes up in the auction,
   * this is what pre-fills the bid field.
   */
  lockedBids: Record<string, number>;
  captainParticipantId?: string;
  captainGraceStartedAt?: number;
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
  /**
   * marks that the participant has submitted on the brainstorm wall.
   * one submission per participant.
   */
  brainstormSubmitted?: boolean;
}

export interface Auction {
  valueId: string;
  startedAt: number;
  durationMs: number;
  highBid?: { teamId: string; amount: number; at: number };
  lockedIn: boolean;
  winnerTeamId?: string;
  /**
   * marks a practice-round auction so consumers never confuse it with the
   * real auction. practice bids never touch real credos or wonValues.
   */
  practice?: boolean;
}

export interface BrainstormResponse {
  id: string;
  participantId: string;
  at: number;
  text: string;
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
    | 'facilitatorOverride'
    | 'brainstormSubmitted'
    | 'brainstormHidden'
    | 'pollVoted'
    | 'bidLocked'
    | 'bidUnlocked'
    | 'captainClaimed'
    | 'captainTransferred'
    | 'practiceStarted'
    | 'practiceEnded';
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
  | { type: 'REFUND_CREDOS'; teamId: string; amount: number; at: number }
  | { type: 'BRAINSTORM_SUBMIT'; participantId: string; text: string; at: number }
  | { type: 'BRAINSTORM_HIDE'; responseId: string }
  | { type: 'POLL_VOTE'; teamId: string; valueId: string; participantId: string; amount: number }
  | { type: 'BID_LOCK'; teamId: string; valueId: string; amount: number }
  | { type: 'BID_UNLOCK'; teamId: string; valueId: string }
  | { type: 'CAPTAIN_CLAIM'; teamId: string; participantId: string; at: number }
  | { type: 'CAPTAIN_PASS'; teamId: string; toParticipantId: string; at: number }
  | {
      type: 'CAPTAIN_AUTO_TRANSFER';
      teamId: string;
      newCaptainId: string;
      reason: 'disconnect' | 'no-claim';
      at: number;
    }
  | { type: 'PRACTICE_START'; durationMs: number; at: number }
  | { type: 'PRACTICE_END'; at: number };
