export type RoomState =
  | "lobby"
  | "frame"
  | "propose"
  | "vote"
  | "criteria_gate"  // facilitator reviews vote-1 results and picks which criteria advance
  | "scale"
  | "vote2"  // vote on per-student scale_responses (round 2)
  | "vote3"  // final binding AI use rung vote (cast after ai_ladder discussion)
  | "calibrate"  // kept for backward compat with rooms created before the rework
  | "ai_ladder_propose"  // each student posts a level + rationale
  | "ai_ladder"  // everyone votes on the proposals
  | "pledge"
  | "pledge_vote"  // vote on per-student pledge responses (like vote2 for scale)
  | "commit";

export type AiUseLevel = 0 | 1 | 2 | 3 | 4;

export type PledgeSlotIndex = 1 | 2 | 3 | 4;

export type CriterionSource = "seed" | "proposed";
export type CriterionStatus = "proposed" | "selected" | "rejected";

export type Room = {
  id: string;
  code: string;
  learning_outcome: string;
  project_description: string;
  state: RoomState;
  step_started_at: string;
  created_at: string;
  facilitator_nudge: string | null;
  sample_artefact_title: string | null;
  sample_artefact_content: string | null;
  timer_end: string | null;
  timer_duration: number | null;
  host_token: string;
};

export type Criterion = {
  id: string;
  room_id: string;
  name: string;
  good_description: string | null;
  failure_description: string | null;
  source: CriterionSource;
  required: boolean;
  status: CriterionStatus;
  position: number;
  created_at: string;
  version_of: string | null;
};

export type Participant = {
  id: string;
  room_id: string;
  joined_at: string;
  last_seen_at: string;
};

export type Vote = {
  id: string;
  participant_id: string;
  criterion_id: string;
  round: 1 | 2 | 3;
  created_at: string;
};

export type Scale = {
  id: string;
  criterion_id: string;
  level: 1 | 2 | 3 | 4;
  descriptor: string;
  updated_at: string;
};

export type ScaleResponse = {
  id: string;
  participant_id: string;
  criterion_id: string;
  level: 1 | 2 | 3 | 4;
  descriptor: string;
  updated_at: string;
};

export type CalibrationScore = {
  id: string;
  participant_id: string;
  criterion_id: string;
  level: 1 | 2 | 3 | 4;
  created_at: string;
};

export type AiUseVote = {
  id: string;
  participant_id: string;
  room_id: string;
  level: AiUseLevel;
  created_at: string;
};

export type ScaleResponseVote = {
  id: string;
  participant_id: string;
  scale_response_id: string;
  created_at: string;
};

export type AiUseProposal = {
  id: string;
  room_id: string;
  participant_id: string;
  level: AiUseLevel;
  rationale: string;
  created_at: string;
};

export type AiUseProposalVote = {
  id: string;
  participant_id: string;
  proposal_id: string;
  created_at: string;
};

export type PledgeSlot = {
  id: string;
  room_id: string;
  slot_index: PledgeSlotIndex;
  content: string;
  updated_at: string;
};

export type PledgeResponse = {
  id: string;
  participant_id: string;
  room_id: string;
  slot_index: PledgeSlotIndex;
  content: string;
  updated_at: string;
};

export type PledgeResponseVote = {
  id: string;
  participant_id: string;
  pledge_response_id: string;
  created_at: string;
};

// Presence summary for the facilitator UI. Active = pinged within the
// PRESENCE_ACTIVE_MS window; idle = joined but not pinged recently. The
// total is participants_count.
export type Presence = {
  active: number;
  idle: number;
};

// Tunables shared between client (heartbeat interval) and server (active
// window). Active window MUST be > heartbeat interval + jitter so an idle
// but online participant doesn't flicker between active/idle between beats.
export const HEARTBEAT_INTERVAL_MS = 240_000; // 4 minutes
export const PRESENCE_ACTIVE_MS = 360_000; // 6 minutes

export type RoomSnapshot = {
  room: Room;
  criteria: Criterion[];
  participants_count: number;
  presence: Presence;
  votes: Vote[];
  scales: Scale[];
  scale_responses: ScaleResponse[];
  scale_response_votes: ScaleResponseVote[];
  calibration_scores: CalibrationScore[];
  ai_use_votes: AiUseVote[];
  ai_use_proposals: AiUseProposal[];
  ai_use_proposal_votes: AiUseProposalVote[];
  pledge_slots: PledgeSlot[];
  pledge_responses: PledgeResponse[];
  pledge_response_votes: PledgeResponseVote[];
};

export const SEED_CRITERIA: Array<Pick<Criterion, "name" | "good_description">> = [
  {
    name: "clarity",
    good_description: "the reader understands the point without needing to ask.",
  },
  {
    name: "collaboration",
    good_description: "every voice on the team left a fingerprint on the work.",
  },
  {
    name: "evidence",
    good_description: "claims are backed by sources the reader can check.",
  },
  {
    name: "execution",
    good_description: "the thing works, end to end, on the day it is due.",
  },
];

export const ARTIFACT_EXAMPLES = [
  "presentation",
  "essay",
  "prototype",
  "portfolio",
  "case study",
  "code project",
  "research paper",
  "design mockup",
  "video",
];

export const SCALE_LEVELS: Array<{ level: 1 | 2 | 3 | 4; label: string }> = [
  { level: 1, label: "novice" },
  { level: 2, label: "emerging" },
  { level: 3, label: "proficient" },
  { level: 4, label: "advanced" },
];

export const DEFAULT_DESCRIPTORS: Record<1 | 2 | 3 | 4, string> = {
  1: "the thing is missing or so thin it doesn't land. a reader couldn't tell what the team meant to do.",
  2: "it's there, but uneven. pieces are strong, pieces are thin, the overall effect wobbles.",
  3: "it does the job. a reader gets it, the team did the work, nothing major is missing.",
  4: "it does the job with craft. clear, tight, evidence-backed. a reader would share it unprompted.",
};

export const AI_USE_LEVELS: Array<{
  level: AiUseLevel;
  name: string;
  helper: string;
}> = [
  {
    level: 0,
    name: "no AI anywhere.",
    helper:
      "nothing in this project touches an AI tool. research, drafting, feedback, polishing — all human.",
  },
  {
    level: 1,
    name: "AI for brainstorming only.",
    helper:
      "we can use AI to explore ideas at the start. every word in the final artefact is ours.",
  },
  {
    level: 2,
    name: "AI for feedback on drafts.",
    helper:
      "we draft, then use AI to test for clarity or gaps. we rewrite based on what we learn. the AI doesn't hold the pen.",
  },
  {
    level: 3,
    name: "AI co-authors our work, disclosed.",
    helper:
      "AI contributes to the drafting itself. we disclose where and how in the artefact.",
  },
  {
    level: 4,
    name: "AI is the subject we're studying.",
    helper:
      "the project is about AI. using AI tools is part of the inquiry. we document what we used and what we found.",
  },
];

export const PLEDGE_SLOTS: Array<{
  index: PledgeSlotIndex;
  label: string;
  placeholder: string;
}> = [
  {
    index: 1,
    label: "we will use AI for:",
    placeholder:
      "e.g., checking our argument for gaps, testing our summary for clarity",
  },
  {
    index: 2,
    label: "we will NOT use AI for:",
    placeholder: "e.g., writing the introduction, generating citations",
  },
  {
    index: 3,
    label: "we will disclose:",
    placeholder:
      "e.g., which tools we used, which sections AI touched, which prompts we used",
  },
  {
    index: 4,
    label: "if we cross our own line, we will:",
    placeholder:
      "e.g., flag it to the facilitator, rewrite the crossed section, note it in our final submission",
  },
];

export function roundForState(state: RoomState): 1 | 2 | 3 {
  if (state === "vote2") return 2;
  if (state === "vote3") return 3;
  return 1;
}

// Canonical forward progression of room states. Shared between the host
// UI (which uses it for "what's next?" arrows + auto-advance on timer
// expiry) and the server-side transition validator below.
//
// `calibrate` is a legacy state that pre-dates the rework — rooms created
// before the move to vote2/vote3 still land there. It's intentionally
// NOT in STATE_ORDER; canTransitionTo() short-circuits to "allowed" when
// either side of the transition is calibrate, so old rooms keep working.
export const STATE_ORDER: RoomState[] = [
  "lobby",
  "frame",
  "propose",
  "vote",
  "criteria_gate",
  "scale",
  "vote2",
  "ai_ladder_propose",
  "ai_ladder",
  "vote3",
  "pledge",
  "pledge_vote",
  "commit",
];

/**
 * Forward-only state-machine guard. Rejects requests that try to skip
 * ahead in the workflow — without this, a host could PATCH the room
 * straight from `lobby` to `commit` and produce a nonsensical rubric.
 *
 * Allowed:
 *   - same state (no-op)
 *   - exactly one step forward in STATE_ORDER
 *   - any number of steps backward (facilitator misclick recovery)
 *   - any transition involving `calibrate` (legacy escape hatch)
 *
 * Rejected:
 *   - forward jumps of more than one step
 *
 * Returns a discriminated union so the caller can produce a structured
 * 409 payload telling the client what the valid next state would be.
 */
export type TransitionResult =
  | { ok: true }
  | {
      ok: false;
      reason: "invalid_transition";
      from: RoomState;
      to: RoomState;
      allowed_next: RoomState | null;
    };

export function canTransitionTo(from: RoomState, to: RoomState): TransitionResult {
  if (from === to) return { ok: true };
  // Legacy carve-out: rooms created before the rework can move in/out of
  // `calibrate` freely. New rooms never enter this state.
  if (from === "calibrate" || to === "calibrate") return { ok: true };

  const fromIdx = STATE_ORDER.indexOf(from);
  const toIdx = STATE_ORDER.indexOf(to);
  // Defensive: if either state isn't in STATE_ORDER (e.g. a new state was
  // added to RoomState but not to the order array), don't block — the
  // type system would catch the mismatch in a code review.
  if (fromIdx === -1 || toIdx === -1) return { ok: true };

  // Backward (or no-op): allowed
  if (toIdx <= fromIdx) return { ok: true };
  // Forward exactly one step: allowed
  if (toIdx === fromIdx + 1) return { ok: true };
  // Forward >1 step: rejected
  return {
    ok: false,
    reason: "invalid_transition",
    from,
    to,
    allowed_next: fromIdx < STATE_ORDER.length - 1 ? STATE_ORDER[fromIdx + 1] : null,
  };
}
