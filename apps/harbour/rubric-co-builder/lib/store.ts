import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type {
  AiUseLevel,
  AiUseProposal,
  AiUseProposalVote,
  AiUseVote,
  CalibrationScore,
  Criterion,
  CriterionSource,
  Participant,
  PledgeResponse,
  PledgeResponseVote,
  PledgeSlot,
  PledgeSlotIndex,
  Room,
  RoomSnapshot,
  RoomState,
  Scale,
  ScaleResponse,
  ScaleResponseVote,
  Vote,
} from "./types";
import { DEFAULT_DESCRIPTORS, PLEDGE_SLOTS, SCALE_LEVELS } from "./types";

type CreateRoomInput = {
  code: string;
  learning_outcome: string;
  project_description: string;
};

type CreateCriterionInput = {
  room_id: string;
  name: string;
  good_description: string | null;
  failure_description?: string | null;
  source: CriterionSource;
  required: boolean;
  position: number;
  status?: "proposed" | "selected";
  version_of?: string | null;
};

type UpdateCriterionInput = {
  name?: string;
  good_description?: string | null;
  failure_description?: string | null;
};

export type Store = {
  codeExists(code: string): Promise<boolean>;
  createRoom(input: CreateRoomInput): Promise<Room>;
  createCriterion(input: CreateCriterionInput): Promise<Criterion>;
  updateCriterion(id: string, patch: UpdateCriterionInput): Promise<Criterion | null>;
  deleteCriterion(id: string): Promise<boolean>;
  setCriterionStatus(id: string, status: "selected" | "rejected"): Promise<Criterion | null>;
  getSnapshot(code: string): Promise<RoomSnapshot | null>;
  updateRoomState(code: string, state: RoomState): Promise<Room | null>;
  joinRoom(code: string): Promise<Participant | null>;
  participantExists(id: string, roomCode: string): Promise<boolean>;

  castVote(participantId: string, criterionId: string, round: 1 | 2 | 3): Promise<Vote | null>;
  removeVote(participantId: string, criterionId: string, round: 1 | 2 | 3): Promise<boolean>;
  countVotesForParticipant(participantId: string, roomId: string, round: 1 | 2 | 3): Promise<number>;

  tallySelection(
    code: string,
    round: 1 | 2 | 3,
    nextState: RoomState,
  ): Promise<{ selected: Criterion[]; scales: Scale[]; tied: boolean } | null>;

  upsertScaleDescriptor(
    criterionId: string,
    level: 1 | 2 | 3 | 4,
    descriptor: string,
  ): Promise<Scale | null>;

  upsertScaleResponse(
    participantId: string,
    criterionId: string,
    level: 1 | 2 | 3 | 4,
    descriptor: string,
  ): Promise<ScaleResponse | null>;

  submitCalibrationScore(
    participantId: string,
    criterionId: string,
    level: 1 | 2 | 3 | 4,
  ): Promise<CalibrationScore | null>;

  castAiVote(
    participantId: string,
    roomCode: string,
    level: AiUseLevel,
  ): Promise<AiUseVote | null>;

  tallyAiLadder(
    code: string,
  ): Promise<{ ceiling: AiUseLevel; counts: Record<AiUseLevel, number> } | null>;

  castScaleResponseVote(
    participantId: string,
    scaleResponseId: string,
  ): Promise<ScaleResponseVote | null>;
  removeScaleResponseVote(
    participantId: string,
    scaleResponseId: string,
  ): Promise<boolean>;

  // picks the most-voted scale_response per (criterion, level) and writes its
  // descriptor into canonical scales. advances the room to `nextState`.
  tallyScaleResponseVotes(
    code: string,
    nextState: RoomState,
  ): Promise<{ winners: Scale[] } | null>;

  upsertAiProposal(
    participantId: string,
    roomCode: string,
    level: AiUseLevel,
    rationale: string,
  ): Promise<AiUseProposal | null>;

  castAiProposalVote(
    participantId: string,
    proposalId: string,
  ): Promise<AiUseProposalVote | null>;
  removeAiProposalVote(
    participantId: string,
    proposalId: string,
  ): Promise<boolean>;

  tallyAiProposals(
    code: string,
  ): Promise<{ ceiling: AiUseLevel; counts: Record<AiUseLevel, number> } | null>;

  tallyAiVote(code: string): Promise<{ ceiling: AiUseLevel } | null>;

  upsertPledgeResponse(
    code: string,
    participantId: string,
    slotIndex: PledgeSlotIndex,
    content: string,
  ): Promise<PledgeResponse | null>;

  castPledgeResponseVote(
    participantId: string,
    pledgeResponseId: string,
  ): Promise<PledgeResponseVote | null>;

  removePledgeResponseVote(
    participantId: string,
    pledgeResponseId: string,
  ): Promise<boolean>;

  tallyPledgeVotes(code: string): Promise<{ winners: PledgeSlot[] } | null>;

  upsertPledgeSlot(
    roomCode: string,
    slotIndex: PledgeSlotIndex,
    content: string,
  ): Promise<PledgeSlot | null>;

  setFacilitatorNudge(code: string, text: string | null): Promise<Room | null>;

  setSampleArtefact(
    code: string,
    title: string,
    content: string,
  ): Promise<Room | null>;

  setTimer(code: string, durationSeconds: number | null): Promise<Room | null>;
};

function uuid(): string {
  return crypto.randomUUID();
}

// ---------- in-memory backend ----------

type MemoryDb = {
  rooms: Map<string, Room>;
  criteria: Map<string, Criterion>;
  participants: Map<string, Participant>;
  votes: Map<string, Vote>;
  scales: Map<string, Scale>;
  scaleResponses: Map<string, ScaleResponse>;
  scaleResponseVotes: Map<string, ScaleResponseVote>;
  calibration: Map<string, CalibrationScore>;
  aiVotes: Map<string, AiUseVote>;
  aiProposals: Map<string, AiUseProposal>;
  aiProposalVotes: Map<string, AiUseProposalVote>;
  pledgeSlots: Map<string, PledgeSlot>;
  pledgeResponses: Map<string, PledgeResponse>;
  pledgeResponseVotes: Map<string, PledgeResponseVote>;
};

function memoryStore(): Store {
  const db: MemoryDb = {
    rooms: new Map(),
    criteria: new Map(),
    participants: new Map(),
    votes: new Map(),
    scales: new Map(),
    scaleResponses: new Map(),
    scaleResponseVotes: new Map(),
    calibration: new Map(),
    aiVotes: new Map(),
    aiProposals: new Map(),
    aiProposalVotes: new Map(),
    pledgeSlots: new Map(),
    pledgeResponses: new Map(),
    pledgeResponseVotes: new Map(),
  };

  function findByCode(code: string): Room | null {
    for (const r of db.rooms.values()) if (r.code === code) return r;
    return null;
  }

  function voteKey(participantId: string, criterionId: string, round: number): string {
    return `${participantId}:${criterionId}:${round}`;
  }

  function scaleKey(criterionId: string, level: number): string {
    return `${criterionId}:${level}`;
  }

  function scaleResponseKey(participantId: string, criterionId: string, level: number): string {
    return `${participantId}:${criterionId}:${level}`;
  }

  function calibrationKey(participantId: string, criterionId: string): string {
    return `${participantId}:${criterionId}`;
  }

  return {
    async codeExists(code) {
      return findByCode(code) !== null;
    },

    async createRoom(input) {
      const now = new Date().toISOString();
      const room: Room = {
        id: uuid(),
        code: input.code,
        learning_outcome: input.learning_outcome,
        project_description: input.project_description,
        state: "lobby",
        step_started_at: now,
        created_at: now,
        facilitator_nudge: null,
        sample_artefact_title: null,
        sample_artefact_content: null,
        timer_end: null,
        timer_duration: null,
      };
      db.rooms.set(room.id, room);
      for (const slot of PLEDGE_SLOTS) {
        const s: PledgeSlot = {
          id: uuid(),
          room_id: room.id,
          slot_index: slot.index,
          content: "",
          updated_at: now,
        };
        db.pledgeSlots.set(`${room.id}:${slot.index}`, s);
      }
      return room;
    },

    async createCriterion(input) {
      const criterion: Criterion = {
        id: uuid(),
        room_id: input.room_id,
        name: input.name,
        good_description: input.good_description,
        failure_description: input.failure_description ?? null,
        source: input.source,
        required: input.required,
        status: input.status ?? (input.source === "seed" ? "selected" : "proposed"),
        position: input.position,
        created_at: new Date().toISOString(),
        version_of: input.version_of ?? null,
      };
      db.criteria.set(criterion.id, criterion);
      return criterion;
    },

    async updateCriterion(id, patch) {
      const existing = db.criteria.get(id);
      if (!existing) return null;
      const updated: Criterion = {
        ...existing,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.good_description !== undefined
          ? { good_description: patch.good_description }
          : {}),
        ...(patch.failure_description !== undefined
          ? { failure_description: patch.failure_description }
          : {}),
      };
      db.criteria.set(id, updated);
      return updated;
    },

    async deleteCriterion(id) {
      const existing = db.criteria.get(id);
      if (!existing) return false;
      db.criteria.delete(id);
      for (const [k, v] of db.votes) if (v.criterion_id === id) db.votes.delete(k);
      for (const [k, s] of db.scales) if (s.criterion_id === id) db.scales.delete(k);
      for (const [k, sr] of db.scaleResponses) if (sr.criterion_id === id) db.scaleResponses.delete(k);
      for (const [k, c] of db.calibration)
        if (c.criterion_id === id) db.calibration.delete(k);
      return true;
    },

    async setCriterionStatus(id, status) {
      const existing = db.criteria.get(id);
      if (!existing) return null;
      const updated: Criterion = { ...existing, status };
      db.criteria.set(id, updated);
      return updated;
    },

    async getSnapshot(code) {
      const room = findByCode(code);
      if (!room) return null;
      const criteria = [...db.criteria.values()]
        .filter((c) => c.room_id === room.id)
        .sort((a, b) =>
          a.position !== b.position
            ? a.position - b.position
            : a.created_at.localeCompare(b.created_at),
        );
      const criterionIds = new Set(criteria.map((c) => c.id));
      const participants_count = [...db.participants.values()].filter(
        (p) => p.room_id === room.id,
      ).length;
      const votes = [...db.votes.values()].filter((v) => criterionIds.has(v.criterion_id));
      const scales = [...db.scales.values()].filter((s) => criterionIds.has(s.criterion_id));
      const scale_responses = [...db.scaleResponses.values()].filter((sr) =>
        criterionIds.has(sr.criterion_id),
      );
      const scaleResponseIds = new Set(scale_responses.map((sr) => sr.id));
      const scale_response_votes = [...db.scaleResponseVotes.values()].filter((srv) =>
        scaleResponseIds.has(srv.scale_response_id),
      );
      const calibration_scores = [...db.calibration.values()].filter((c) =>
        criterionIds.has(c.criterion_id),
      );
      const ai_use_votes = [...db.aiVotes.values()].filter((v) => v.room_id === room.id);
      const ai_use_proposals = [...db.aiProposals.values()].filter(
        (p) => p.room_id === room.id,
      );
      const proposalIds = new Set(ai_use_proposals.map((p) => p.id));
      const ai_use_proposal_votes = [...db.aiProposalVotes.values()].filter((pv) =>
        proposalIds.has(pv.proposal_id),
      );
      const pledge_slots = [...db.pledgeSlots.values()]
        .filter((s) => s.room_id === room.id)
        .sort((a, b) => a.slot_index - b.slot_index);
      const pledge_responses = [...db.pledgeResponses.values()].filter(
        (pr) => pr.room_id === room.id,
      );
      const pledgeResponseIds = new Set(pledge_responses.map((pr) => pr.id));
      const pledge_response_votes = [...db.pledgeResponseVotes.values()].filter((prv) =>
        pledgeResponseIds.has(prv.pledge_response_id),
      );
      return {
        room,
        criteria,
        participants_count,
        votes,
        scales,
        scale_responses,
        scale_response_votes,
        calibration_scores,
        ai_use_votes,
        ai_use_proposals,
        ai_use_proposal_votes,
        pledge_slots,
        pledge_responses,
        pledge_response_votes,
      };
    },

    async updateRoomState(code, state) {
      const room = findByCode(code);
      if (!room) return null;
      const updated: Room = {
        ...room,
        state,
        step_started_at: new Date().toISOString(),
        timer_end: null,
        timer_duration: null,
      };
      db.rooms.set(updated.id, updated);
      return updated;
    },

    async joinRoom(code) {
      const room = findByCode(code);
      if (!room) return null;
      const participant: Participant = {
        id: uuid(),
        room_id: room.id,
        joined_at: new Date().toISOString(),
      };
      db.participants.set(participant.id, participant);
      return participant;
    },

    async participantExists(id, roomCode) {
      const room = findByCode(roomCode);
      if (!room) return false;
      const p = db.participants.get(id);
      return !!p && p.room_id === room.id;
    },

    async castVote(participantId, criterionId, round) {
      const key = voteKey(participantId, criterionId, round);
      if (db.votes.has(key)) return db.votes.get(key)!;
      const participant = db.participants.get(participantId);
      const criterion = db.criteria.get(criterionId);
      if (!participant || !criterion) return null;
      const vote: Vote = {
        id: uuid(),
        participant_id: participantId,
        criterion_id: criterionId,
        round,
        created_at: new Date().toISOString(),
      };
      db.votes.set(key, vote);
      return vote;
    },

    async removeVote(participantId, criterionId, round) {
      return db.votes.delete(voteKey(participantId, criterionId, round));
    },

    async countVotesForParticipant(participantId, roomId, round) {
      const roomCriteriaIds = new Set(
        [...db.criteria.values()].filter((c) => c.room_id === roomId).map((c) => c.id),
      );
      return [...db.votes.values()].filter(
        (v) =>
          v.participant_id === participantId &&
          roomCriteriaIds.has(v.criterion_id) &&
          v.round === round,
      ).length;
    },

    async tallySelection(code, round, nextState) {
      const room = findByCode(code);
      if (!room) return null;
      const roomCriteria = [...db.criteria.values()].filter((c) => c.room_id === room.id);

      // count votes for this specific round only
      const counts = new Map<string, number>();
      for (const v of db.votes.values()) {
        if (v.round === round && roomCriteria.some((c) => c.id === v.criterion_id)) {
          counts.set(v.criterion_id, (counts.get(v.criterion_id) ?? 0) + 1);
        }
      }

      // select ALL criteria with ≥1 vote + any required ones
      const requiredIds = new Set(
        roomCriteria.filter((c) => c.required).map((c) => c.id),
      );
      const picked = new Set<string>(requiredIds);
      for (const c of roomCriteria) {
        if ((counts.get(c.id) ?? 0) >= 1) picked.add(c.id);
      }
      // fallback: if nothing picked beyond required, keep top 3
      if (picked.size === requiredIds.size && roomCriteria.length > 0) {
        const sorted = roomCriteria
          .filter((c) => !c.required)
          .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
        for (const c of sorted.slice(0, 3)) picked.add(c.id);
      }

      // detect ties: are there criteria at the exact same vote count at the boundary?
      const voteCounts = [...picked].map((id) => counts.get(id) ?? 0);
      const minPicked = Math.min(...voteCounts);
      const notPickedWithSameCount = roomCriteria.filter(
        (c) => !picked.has(c.id) && (counts.get(c.id) ?? 0) === minPicked && minPicked > 0,
      );
      const tied = notPickedWithSameCount.length > 0;

      // update statuses and positions
      let position = 0;
      const selected: Criterion[] = [];
      for (const c of roomCriteria) {
        if (picked.has(c.id)) {
          const updated: Criterion = { ...c, status: "selected", position: position++ };
          db.criteria.set(c.id, updated);
          selected.push(updated);
        } else {
          db.criteria.set(c.id, { ...c, status: "rejected" });
        }
      }
      selected.sort((a, b) => a.position - b.position);

      // seed scale descriptors for selected criteria (idempotent)
      const scales: Scale[] = [];
      for (const c of selected) {
        for (const { level } of SCALE_LEVELS) {
          const key = scaleKey(c.id, level);
          if (!db.scales.has(key)) {
            const scale: Scale = {
              id: uuid(),
              criterion_id: c.id,
              level,
              descriptor: DEFAULT_DESCRIPTORS[level],
              updated_at: new Date().toISOString(),
            };
            db.scales.set(key, scale);
            scales.push(scale);
          } else {
            scales.push(db.scales.get(key)!);
          }
        }
      }

      // advance state
      const updatedRoom: Room = {
        ...room,
        state: nextState,
        step_started_at: new Date().toISOString(),
      };
      db.rooms.set(updatedRoom.id, updatedRoom);

      return { selected, scales, tied };
    },

    async upsertScaleDescriptor(criterionId, level, descriptor) {
      const key = scaleKey(criterionId, level);
      const existing = db.scales.get(key);
      const now = new Date().toISOString();
      if (existing) {
        const updated: Scale = { ...existing, descriptor, updated_at: now };
        db.scales.set(key, updated);
        return updated;
      }
      const scale: Scale = {
        id: uuid(),
        criterion_id: criterionId,
        level,
        descriptor,
        updated_at: now,
      };
      db.scales.set(key, scale);
      return scale;
    },

    async upsertScaleResponse(participantId, criterionId, level, descriptor) {
      const key = scaleResponseKey(participantId, criterionId, level);
      const existing = db.scaleResponses.get(key);
      const now = new Date().toISOString();
      if (existing) {
        const updated: ScaleResponse = { ...existing, descriptor, updated_at: now };
        db.scaleResponses.set(key, updated);
        return updated;
      }
      const sr: ScaleResponse = {
        id: uuid(),
        participant_id: participantId,
        criterion_id: criterionId,
        level,
        descriptor,
        updated_at: now,
      };
      db.scaleResponses.set(key, sr);
      return sr;
    },

    async submitCalibrationScore(participantId, criterionId, level) {
      const key = calibrationKey(participantId, criterionId);
      const existing = db.calibration.get(key);
      const now = new Date().toISOString();
      if (existing) {
        const updated: CalibrationScore = { ...existing, level, created_at: now };
        db.calibration.set(key, updated);
        return updated;
      }
      const score: CalibrationScore = {
        id: uuid(),
        participant_id: participantId,
        criterion_id: criterionId,
        level,
        created_at: now,
      };
      db.calibration.set(key, score);
      return score;
    },

    async castAiVote(participantId, roomCode, level) {
      const room = findByCode(roomCode);
      if (!room) return null;
      const participant = db.participants.get(participantId);
      if (!participant || participant.room_id !== room.id) return null;
      const key = `${room.id}:${participantId}`;
      const now = new Date().toISOString();
      const existing = db.aiVotes.get(key);
      if (existing) {
        const updated: AiUseVote = { ...existing, level, created_at: now };
        db.aiVotes.set(key, updated);
        return updated;
      }
      const vote: AiUseVote = {
        id: uuid(),
        participant_id: participantId,
        room_id: room.id,
        level,
        created_at: now,
      };
      db.aiVotes.set(key, vote);
      return vote;
    },

    async tallyAiLadder(code) {
      const room = findByCode(code);
      if (!room) return null;
      const counts: Record<AiUseLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      for (const v of db.aiVotes.values()) {
        if (v.room_id === room.id) counts[v.level]++;
      }
      let ceiling: AiUseLevel = 0;
      let bestCount = -1;
      for (const lvl of [0, 1, 2, 3, 4] as AiUseLevel[]) {
        if (counts[lvl] > bestCount) {
          bestCount = counts[lvl];
          ceiling = lvl;
        }
      }
      return { ceiling, counts };
    },

    async tallyAiVote(code) {
      const room = findByCode(code);
      if (!room) return null;
      const counts: Record<AiUseLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      for (const v of db.aiVotes.values()) {
        if (v.room_id === room.id) counts[v.level]++;
      }
      let ceiling: AiUseLevel = 0;
      let bestCount = -1;
      for (const lvl of [0, 1, 2, 3, 4] as AiUseLevel[]) {
        if (counts[lvl] > bestCount) {
          bestCount = counts[lvl];
          ceiling = lvl;
        }
      }
      const updated: Room = {
        ...room,
        state: "pledge",
        step_started_at: new Date().toISOString(),
        timer_end: null,
        timer_duration: null,
      };
      db.rooms.set(updated.id, updated);
      return { ceiling };
    },

    async upsertPledgeResponse(code, participantId, slotIndex, content) {
      const room = findByCode(code);
      if (!room) return null;
      const key = `${room.id}:${participantId}:${slotIndex}`;
      const now = new Date().toISOString();
      const existing = db.pledgeResponses.get(key);
      const pr: PledgeResponse = existing
        ? { ...existing, content, updated_at: now }
        : {
            id: uuid(),
            participant_id: participantId,
            room_id: room.id,
            slot_index: slotIndex,
            content,
            updated_at: now,
          };
      db.pledgeResponses.set(key, pr);
      return pr;
    },

    async castPledgeResponseVote(participantId, pledgeResponseId) {
      const key = `${participantId}:${pledgeResponseId}`;
      if (db.pledgeResponseVotes.has(key)) return db.pledgeResponseVotes.get(key)!;
      if (!db.participants.has(participantId)) return null;
      const exists = [...db.pledgeResponses.values()].some((pr) => pr.id === pledgeResponseId);
      if (!exists) return null;
      const vote: PledgeResponseVote = {
        id: uuid(),
        participant_id: participantId,
        pledge_response_id: pledgeResponseId,
        created_at: new Date().toISOString(),
      };
      db.pledgeResponseVotes.set(key, vote);
      return vote;
    },

    async removePledgeResponseVote(participantId, pledgeResponseId) {
      return db.pledgeResponseVotes.delete(`${participantId}:${pledgeResponseId}`);
    },

    async tallyPledgeVotes(code) {
      const room = findByCode(code);
      if (!room) return null;
      const responses = [...db.pledgeResponses.values()].filter((pr) => pr.room_id === room.id);
      const responseIds = new Set(responses.map((pr) => pr.id));
      const voteCounts = new Map<string, number>();
      for (const v of db.pledgeResponseVotes.values()) {
        if (responseIds.has(v.pledge_response_id)) {
          voteCounts.set(v.pledge_response_id, (voteCounts.get(v.pledge_response_id) ?? 0) + 1);
        }
      }
      const winners: PledgeSlot[] = [];
      for (const slotIndex of [1, 2, 3, 4] as PledgeSlotIndex[]) {
        const candidates = responses.filter((pr) => pr.slot_index === slotIndex);
        if (candidates.length === 0) continue;
        const sorted = [...candidates].sort((a, b) => {
          const ca = voteCounts.get(a.id) ?? 0;
          const cb = voteCounts.get(b.id) ?? 0;
          if (cb !== ca) return cb - ca;
          return a.updated_at.localeCompare(b.updated_at);
        });
        const top = sorted[0];
        if (!top.content.trim()) continue;
        const key = `${room.id}:${slotIndex}`;
        const now = new Date().toISOString();
        const existing = db.pledgeSlots.get(key);
        const updated: PledgeSlot = existing
          ? { ...existing, content: top.content, updated_at: now }
          : {
              id: uuid(),
              room_id: room.id,
              slot_index: slotIndex,
              content: top.content,
              updated_at: now,
            };
        db.pledgeSlots.set(key, updated);
        winners.push(updated);
      }
      const updatedRoom: Room = {
        ...room,
        state: "commit",
        step_started_at: new Date().toISOString(),
        timer_end: null,
        timer_duration: null,
      };
      db.rooms.set(updatedRoom.id, updatedRoom);
      return { winners };
    },

    async upsertPledgeSlot(roomCode, slotIndex, content) {
      const room = findByCode(roomCode);
      if (!room) return null;
      const key = `${room.id}:${slotIndex}`;
      const now = new Date().toISOString();
      const existing = db.pledgeSlots.get(key);
      const slot: PledgeSlot = existing
        ? { ...existing, content, updated_at: now }
        : {
            id: uuid(),
            room_id: room.id,
            slot_index: slotIndex,
            content,
            updated_at: now,
          };
      db.pledgeSlots.set(key, slot);
      return slot;
    },

    async setFacilitatorNudge(code, text) {
      const room = findByCode(code);
      if (!room) return null;
      const updated: Room = { ...room, facilitator_nudge: text };
      db.rooms.set(updated.id, updated);
      return updated;
    },

    async setSampleArtefact(code, title, content) {
      const room = findByCode(code);
      if (!room) return null;
      const updated: Room = {
        ...room,
        sample_artefact_title: title,
        sample_artefact_content: content,
      };
      db.rooms.set(updated.id, updated);
      return updated;
    },

    async setTimer(code, durationSeconds) {
      const room = findByCode(code);
      if (!room) return null;
      const updated: Room = {
        ...room,
        timer_end: durationSeconds !== null
          ? new Date(Date.now() + durationSeconds * 1000).toISOString()
          : null,
        timer_duration: durationSeconds,
      };
      db.rooms.set(updated.id, updated);
      return updated;
    },

    async castScaleResponseVote(participantId, scaleResponseId) {
      const key = `${participantId}:${scaleResponseId}`;
      if (db.scaleResponseVotes.has(key)) return db.scaleResponseVotes.get(key)!;
      if (!db.participants.has(participantId)) return null;
      const exists = [...db.scaleResponses.values()].some((sr) => sr.id === scaleResponseId);
      if (!exists) return null;
      const vote: ScaleResponseVote = {
        id: uuid(),
        participant_id: participantId,
        scale_response_id: scaleResponseId,
        created_at: new Date().toISOString(),
      };
      db.scaleResponseVotes.set(key, vote);
      return vote;
    },

    async removeScaleResponseVote(participantId, scaleResponseId) {
      return db.scaleResponseVotes.delete(`${participantId}:${scaleResponseId}`);
    },

    async tallyScaleResponseVotes(code, nextState) {
      const room = findByCode(code);
      if (!room) return null;
      const roomCriteria = [...db.criteria.values()].filter((c) => c.room_id === room.id);
      const roomCriteriaIds = new Set(roomCriteria.map((c) => c.id));
      const roomResponses = [...db.scaleResponses.values()].filter((sr) =>
        roomCriteriaIds.has(sr.criterion_id),
      );
      const roomResponseIds = new Set(roomResponses.map((sr) => sr.id));

      const voteCounts = new Map<string, number>();
      for (const v of db.scaleResponseVotes.values()) {
        if (roomResponseIds.has(v.scale_response_id)) {
          voteCounts.set(
            v.scale_response_id,
            (voteCounts.get(v.scale_response_id) ?? 0) + 1,
          );
        }
      }

      // pick winner per (criterion, level)
      const winners: Scale[] = [];
      const selectedCriteria = roomCriteria.filter((c) => c.status === "selected");
      for (const c of selectedCriteria) {
        for (const { level } of SCALE_LEVELS) {
          const candidates = roomResponses.filter(
            (sr) => sr.criterion_id === c.id && sr.level === level,
          );
          if (candidates.length === 0) continue;
          const sorted = [...candidates].sort((a, b) => {
            const ca = voteCounts.get(a.id) ?? 0;
            const cb = voteCounts.get(b.id) ?? 0;
            if (cb !== ca) return cb - ca;
            // tiebreak: earlier descriptor wins
            return a.updated_at.localeCompare(b.updated_at);
          });
          const top = sorted[0];
          if (!top.descriptor.trim()) continue;
          const key = scaleKey(c.id, level);
          const now = new Date().toISOString();
          const existing = db.scales.get(key);
          const updated: Scale = existing
            ? { ...existing, descriptor: top.descriptor, updated_at: now }
            : {
                id: uuid(),
                criterion_id: c.id,
                level,
                descriptor: top.descriptor,
                updated_at: now,
              };
          db.scales.set(key, updated);
          winners.push(updated);
        }
      }

      const updatedRoom: Room = {
        ...room,
        state: nextState,
        step_started_at: new Date().toISOString(),
        timer_end: null,
        timer_duration: null,
      };
      db.rooms.set(updatedRoom.id, updatedRoom);
      return { winners };
    },

    async upsertAiProposal(participantId, roomCode, level, rationale) {
      const room = findByCode(roomCode);
      if (!room) return null;
      const participant = db.participants.get(participantId);
      if (!participant || participant.room_id !== room.id) return null;
      const key = `${room.id}:${participantId}`;
      const now = new Date().toISOString();
      const existing = db.aiProposals.get(key);
      const proposal: AiUseProposal = existing
        ? { ...existing, level, rationale }
        : {
            id: uuid(),
            room_id: room.id,
            participant_id: participantId,
            level,
            rationale,
            created_at: now,
          };
      db.aiProposals.set(key, proposal);
      return proposal;
    },

    async castAiProposalVote(participantId, proposalId) {
      const key = `${participantId}:${proposalId}`;
      if (db.aiProposalVotes.has(key)) return db.aiProposalVotes.get(key)!;
      if (!db.participants.has(participantId)) return null;
      const proposal = [...db.aiProposals.values()].find((p) => p.id === proposalId);
      if (!proposal) return null;
      const vote: AiUseProposalVote = {
        id: uuid(),
        participant_id: participantId,
        proposal_id: proposalId,
        created_at: new Date().toISOString(),
      };
      db.aiProposalVotes.set(key, vote);
      return vote;
    },

    async removeAiProposalVote(participantId, proposalId) {
      return db.aiProposalVotes.delete(`${participantId}:${proposalId}`);
    },

    async tallyAiProposals(code) {
      const room = findByCode(code);
      if (!room) return null;
      const proposals = [...db.aiProposals.values()].filter((p) => p.room_id === room.id);
      const proposalIds = new Set(proposals.map((p) => p.id));
      const perProposal = new Map<string, number>();
      for (const v of db.aiProposalVotes.values()) {
        if (proposalIds.has(v.proposal_id)) {
          perProposal.set(v.proposal_id, (perProposal.get(v.proposal_id) ?? 0) + 1);
        }
      }
      const counts: Record<AiUseLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      for (const p of proposals) {
        counts[p.level] += perProposal.get(p.id) ?? 0;
      }
      // ceiling: level with the most proposal-votes; ties break to the lower rung
      let ceiling: AiUseLevel = 0;
      let best = -1;
      for (const lvl of [0, 1, 2, 3, 4] as AiUseLevel[]) {
        if (counts[lvl] > best) {
          best = counts[lvl];
          ceiling = lvl;
        }
      }
      return { ceiling, counts };
    },
  };
}

// ---------- neon backend ----------

function neonStore(url: string): Store {
  const sql: NeonQueryFunction<false, false> = neon(url);

  return {
    async codeExists(code) {
      const rows = await sql`
        select 1 from rubric_cobuilder.rooms where code = ${code} limit 1
      `;
      return rows.length > 0;
    },

    async createRoom(input) {
      const [row] = await sql`
        insert into rubric_cobuilder.rooms (code, learning_outcome, project_description)
        values (${input.code}, ${input.learning_outcome}, ${input.project_description})
        returning id, code, learning_outcome, project_description, state,
                  step_started_at, created_at,
                  facilitator_nudge, sample_artefact_title, sample_artefact_content
      `;
      for (const slot of PLEDGE_SLOTS) {
        await sql`
          insert into rubric_cobuilder.pledge_slots (room_id, slot_index, content)
          values (${row.id}, ${slot.index}, '')
          on conflict (room_id, slot_index) do nothing
        `;
      }
      return row as Room;
    },

    async createCriterion(input) {
      const [row] = await sql`
        insert into rubric_cobuilder.criteria
          (room_id, name, good_description, failure_description, source,
           required, status, position, version_of)
        values
          (${input.room_id}, ${input.name}, ${input.good_description},
           ${input.failure_description ?? null}, ${input.source},
           ${input.required}, ${input.status ?? (input.source === "seed" ? "selected" : "proposed")},
           ${input.position}, ${input.version_of ?? null})
        returning id, room_id, name, good_description, failure_description,
                  source, required, status, position, created_at, version_of
      `;
      return row as Criterion;
    },

    async updateCriterion(id, patch) {
      const rows = await sql`
        update rubric_cobuilder.criteria
        set
          name = coalesce(${patch.name ?? null}, name),
          good_description = coalesce(${patch.good_description ?? null}, good_description),
          failure_description = coalesce(${patch.failure_description ?? null}, failure_description)
        where id = ${id}
        returning id, room_id, name, good_description, failure_description,
                  source, required, status, position, created_at, version_of
      `;
      return (rows[0] as Criterion | undefined) ?? null;
    },

    async deleteCriterion(id) {
      const rows = await sql`
        delete from rubric_cobuilder.criteria where id = ${id} returning id
      `;
      return rows.length > 0;
    },

    async setCriterionStatus(id, status) {
      const rows = await sql`
        update rubric_cobuilder.criteria
        set status = ${status}
        where id = ${id}
        returning id, room_id, name, good_description, failure_description,
                  source, required, status, position, created_at, version_of
      `;
      return (rows[0] as Criterion | undefined) ?? null;
    },

    async getSnapshot(code) {
      const rooms = await sql`
        select id, code, learning_outcome, project_description, state,
               step_started_at, created_at,
               facilitator_nudge, sample_artefact_title, sample_artefact_content,
               timer_end, timer_duration
        from rubric_cobuilder.rooms
        where code = ${code}
        limit 1
      `;
      if (rooms.length === 0) return null;
      const room = rooms[0] as Room;
      const criteria = (await sql`
        select id, room_id, name, good_description, failure_description,
               source, required, status, position, created_at,
               coalesce(version_of::text, null) as version_of
        from rubric_cobuilder.criteria
        where room_id = ${room.id}
        order by position asc, created_at asc
      `) as Criterion[];
      const [{ count }] = await sql`
        select count(*)::int as count
        from rubric_cobuilder.participants
        where room_id = ${room.id}
      `;
      const votes = (await sql`
        select v.id, v.participant_id, v.criterion_id,
               coalesce(v.round, 1)::int as round, v.created_at
        from rubric_cobuilder.votes v
        join rubric_cobuilder.criteria c on c.id = v.criterion_id
        where c.room_id = ${room.id}
      `) as Vote[];
      const scales = (await sql`
        select s.id, s.criterion_id, s.level, s.descriptor, s.updated_at
        from rubric_cobuilder.scales s
        join rubric_cobuilder.criteria c on c.id = s.criterion_id
        where c.room_id = ${room.id}
      `) as Scale[];
      const scale_responses: ScaleResponse[] = await (sql`
        select sr.id, sr.participant_id, sr.criterion_id, sr.level, sr.descriptor, sr.updated_at
        from rubric_cobuilder.scale_responses sr
        join rubric_cobuilder.criteria c on c.id = sr.criterion_id
        where c.room_id = ${room.id}
      ` as unknown as Promise<ScaleResponse[]>).catch(() => []);
      const calibration_scores = (await sql`
        select cs.id, cs.participant_id, cs.criterion_id, cs.level, cs.created_at
        from rubric_cobuilder.calibration_scores cs
        join rubric_cobuilder.criteria c on c.id = cs.criterion_id
        where c.room_id = ${room.id}
      `) as CalibrationScore[];
      const ai_use_votes = (await sql`
        select id, participant_id, room_id, level, created_at
        from rubric_cobuilder.ai_use_votes
        where room_id = ${room.id}
      `) as AiUseVote[];
      const scale_response_votes: ScaleResponseVote[] = await (sql`
        select srv.id, srv.participant_id, srv.scale_response_id, srv.created_at
        from rubric_cobuilder.scale_response_votes srv
        join rubric_cobuilder.scale_responses sr on sr.id = srv.scale_response_id
        join rubric_cobuilder.criteria c on c.id = sr.criterion_id
        where c.room_id = ${room.id}
      ` as unknown as Promise<ScaleResponseVote[]>).catch(() => []);
      const ai_use_proposals: AiUseProposal[] = await (sql`
        select id, room_id, participant_id, level, rationale, created_at
        from rubric_cobuilder.ai_use_proposals
        where room_id = ${room.id}
        order by created_at asc
      ` as unknown as Promise<AiUseProposal[]>).catch(() => []);
      const ai_use_proposal_votes: AiUseProposalVote[] = await (sql`
        select pv.id, pv.participant_id, pv.proposal_id, pv.created_at
        from rubric_cobuilder.ai_use_proposal_votes pv
        join rubric_cobuilder.ai_use_proposals p on p.id = pv.proposal_id
        where p.room_id = ${room.id}
      ` as unknown as Promise<AiUseProposalVote[]>).catch(() => []);
      const pledge_slots = (await sql`
        select id, room_id, slot_index, content, updated_at
        from rubric_cobuilder.pledge_slots
        where room_id = ${room.id}
        order by slot_index asc
      `) as PledgeSlot[];
      const pledge_responses: PledgeResponse[] = await (sql`
        select id, participant_id, room_id, slot_index, content, updated_at
        from rubric_cobuilder.pledge_responses
        where room_id = ${room.id}
      ` as unknown as Promise<PledgeResponse[]>).catch(() => []);
      const pledge_response_votes: PledgeResponseVote[] = await (sql`
        select prv.id, prv.participant_id, prv.pledge_response_id, prv.created_at
        from rubric_cobuilder.pledge_response_votes prv
        join rubric_cobuilder.pledge_responses pr on pr.id = prv.pledge_response_id
        where pr.room_id = ${room.id}
      ` as unknown as Promise<PledgeResponseVote[]>).catch(() => []);

      return {
        room,
        criteria,
        participants_count: count as number,
        votes,
        scales,
        scale_responses,
        scale_response_votes,
        calibration_scores,
        ai_use_votes,
        ai_use_proposals,
        ai_use_proposal_votes,
        pledge_slots,
        pledge_responses,
        pledge_response_votes,
      };
    },

    async updateRoomState(code, state) {
      const rows = await sql`
        update rubric_cobuilder.rooms
        set state = ${state}, step_started_at = now(),
            timer_end = null, timer_duration = null
        where code = ${code}
        returning id, code, learning_outcome, project_description, state,
                  step_started_at, created_at,
                  facilitator_nudge, sample_artefact_title, sample_artefact_content,
                  timer_end, timer_duration
      `;
      return (rows[0] as Room | undefined) ?? null;
    },

    async joinRoom(code) {
      const rooms = await sql`
        select id from rubric_cobuilder.rooms where code = ${code} limit 1
      `;
      if (rooms.length === 0) return null;
      const [participant] = await sql`
        insert into rubric_cobuilder.participants (room_id)
        values (${rooms[0].id})
        returning id, room_id, joined_at
      `;
      return participant as Participant;
    },

    async participantExists(id, roomCode) {
      const rows = await sql`
        select 1
        from rubric_cobuilder.participants p
        join rubric_cobuilder.rooms r on r.id = p.room_id
        where p.id = ${id} and r.code = ${roomCode}
        limit 1
      `;
      return rows.length > 0;
    },

    async castVote(participantId, criterionId, round) {
      const rows = await sql`
        insert into rubric_cobuilder.votes (participant_id, criterion_id, round)
        values (${participantId}, ${criterionId}, ${round})
        on conflict (participant_id, criterion_id, round) do nothing
        returning id, participant_id, criterion_id, round, created_at
      `.catch(async () => {
        // fallback for tables without the round column yet (old schema)
        return sql`
          insert into rubric_cobuilder.votes (participant_id, criterion_id)
          values (${participantId}, ${criterionId})
          on conflict (participant_id, criterion_id) do nothing
          returning id, participant_id, criterion_id, created_at
        `;
      });
      if (rows.length === 0) {
        const [existing] = await sql`
          select id, participant_id, criterion_id,
                 coalesce(round, 1)::int as round, created_at
          from rubric_cobuilder.votes
          where participant_id = ${participantId} and criterion_id = ${criterionId}
            and coalesce(round, 1) = ${round}
          limit 1
        `;
        return (existing as Vote | undefined) ?? null;
      }
      const row = rows[0] as Record<string, unknown>;
      return { ...row, round: (row.round as number) ?? round } as Vote;
    },

    async removeVote(participantId, criterionId, round) {
      const rows = await sql`
        delete from rubric_cobuilder.votes
        where participant_id = ${participantId} and criterion_id = ${criterionId}
          and coalesce(round, 1) = ${round}
        returning id
      `;
      return rows.length > 0;
    },

    async countVotesForParticipant(participantId, roomId, round) {
      const [{ count }] = await sql`
        select count(*)::int as count
        from rubric_cobuilder.votes v
        join rubric_cobuilder.criteria c on c.id = v.criterion_id
        where v.participant_id = ${participantId} and c.room_id = ${roomId}
          and coalesce(v.round, 1) = ${round}
      `;
      return count as number;
    },

    async tallySelection(code, round, nextState) {
      const [room] = await sql`
        select id from rubric_cobuilder.rooms where code = ${code} limit 1
      `;
      if (!room) return null;
      const roomId = room.id as string;

      const requiredRows = (await sql`
        select id from rubric_cobuilder.criteria
        where room_id = ${roomId} and required = true
      `) as Array<{ id: string }>;

      // select ALL criteria with ≥1 vote in this round
      const voted = (await sql`
        select c.id
        from rubric_cobuilder.criteria c
        join rubric_cobuilder.votes v on v.criterion_id = c.id
        where c.room_id = ${roomId}
          and coalesce(v.round, 1) = ${round}
        group by c.id
        having count(v.id) >= 1
      `) as Array<{ id: string }>;

      const picked = new Set<string>(requiredRows.map((r) => r.id));
      for (const r of voted) picked.add(r.id);

      // fallback: if nothing picked, keep top 3 by votes
      if (picked.size === requiredRows.length) {
        const top3 = (await sql`
          select c.id
          from rubric_cobuilder.criteria c
          left join rubric_cobuilder.votes v
            on v.criterion_id = c.id and coalesce(v.round, 1) = ${round}
          where c.room_id = ${roomId} and c.required = false
          group by c.id
          order by count(v.id) desc, c.position asc
          limit 3
        `) as Array<{ id: string }>;
        for (const r of top3) picked.add(r.id);
      }

      // detect ties at the boundary
      const pickedArr = [...picked];
      const tieCheck = (await sql`
        select c.id, count(v.id)::int as vote_count
        from rubric_cobuilder.criteria c
        left join rubric_cobuilder.votes v
          on v.criterion_id = c.id and coalesce(v.round, 1) = ${round}
        where c.room_id = ${roomId} and c.required = false
        group by c.id
      `) as Array<{ id: string; vote_count: number }>;

      const pickedCounts = tieCheck.filter((r) => picked.has(r.id)).map((r) => r.vote_count);
      const minPicked = pickedCounts.length > 0 ? Math.min(...pickedCounts) : 0;
      const tied =
        minPicked > 0 &&
        tieCheck.some((r) => !picked.has(r.id) && r.vote_count === minPicked);

      // mark selected + rejected
      await sql`
        update rubric_cobuilder.criteria
        set status = 'rejected'
        where room_id = ${roomId}
      `;
      for (let i = 0; i < pickedArr.length; i++) {
        await sql`
          update rubric_cobuilder.criteria
          set status = 'selected', position = ${i}
          where id = ${pickedArr[i]}
        `;
      }

      // seed scale descriptors
      for (const id of pickedArr) {
        for (const { level } of SCALE_LEVELS) {
          await sql`
            insert into rubric_cobuilder.scales (criterion_id, level, descriptor)
            values (${id}, ${level}, ${DEFAULT_DESCRIPTORS[level]})
            on conflict (criterion_id, level) do nothing
          `;
        }
      }

      // advance state
      await sql`
        update rubric_cobuilder.rooms
        set state = ${nextState}, step_started_at = now()
        where id = ${roomId}
      `;

      const selected = (await sql`
        select id, room_id, name, good_description, failure_description,
               source, required, status, position, created_at,
               coalesce(version_of::text, null) as version_of
        from rubric_cobuilder.criteria
        where room_id = ${roomId} and status = 'selected'
        order by position asc
      `) as Criterion[];
      const scales = (await sql`
        select s.id, s.criterion_id, s.level, s.descriptor, s.updated_at
        from rubric_cobuilder.scales s
        join rubric_cobuilder.criteria c on c.id = s.criterion_id
        where c.room_id = ${roomId} and c.status = 'selected'
        order by s.level asc
      `) as Scale[];

      return { selected, scales, tied };
    },

    async upsertScaleDescriptor(criterionId, level, descriptor) {
      const [row] = await sql`
        insert into rubric_cobuilder.scales (criterion_id, level, descriptor)
        values (${criterionId}, ${level}, ${descriptor})
        on conflict (criterion_id, level) do update
          set descriptor = excluded.descriptor, updated_at = now()
        returning id, criterion_id, level, descriptor, updated_at
      `;
      return row as Scale;
    },

    async upsertScaleResponse(participantId, criterionId, level, descriptor) {
      const [row] = await sql`
        insert into rubric_cobuilder.scale_responses
          (participant_id, criterion_id, level, descriptor)
        values (${participantId}, ${criterionId}, ${level}, ${descriptor})
        on conflict (participant_id, criterion_id, level) do update
          set descriptor = excluded.descriptor, updated_at = now()
        returning id, participant_id, criterion_id, level, descriptor, updated_at
      `;
      return row as ScaleResponse;
    },

    async submitCalibrationScore(participantId, criterionId, level) {
      const [row] = await sql`
        insert into rubric_cobuilder.calibration_scores
          (participant_id, criterion_id, level)
        values (${participantId}, ${criterionId}, ${level})
        on conflict (participant_id, criterion_id) do update
          set level = excluded.level, created_at = now()
        returning id, participant_id, criterion_id, level, created_at
      `;
      return row as CalibrationScore;
    },

    async castAiVote(participantId, roomCode, level) {
      const [room] = await sql`
        select id from rubric_cobuilder.rooms where code = ${roomCode} limit 1
      `;
      if (!room) return null;
      const [row] = await sql`
        insert into rubric_cobuilder.ai_use_votes (participant_id, room_id, level)
        values (${participantId}, ${room.id}, ${level})
        on conflict (participant_id, room_id) do update
          set level = excluded.level, created_at = now()
        returning id, participant_id, room_id, level, created_at
      `;
      return row as AiUseVote;
    },

    async tallyAiLadder(code) {
      const [room] = await sql`
        select id from rubric_cobuilder.rooms where code = ${code} limit 1
      `;
      if (!room) return null;
      const rows = (await sql`
        select level, count(*)::int as count
        from rubric_cobuilder.ai_use_votes
        where room_id = ${room.id}
        group by level
      `) as Array<{ level: number; count: number }>;
      const counts: Record<AiUseLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      for (const r of rows) counts[r.level as AiUseLevel] = r.count;
      let ceiling: AiUseLevel = 0;
      let best = -1;
      for (const lvl of [0, 1, 2, 3, 4] as AiUseLevel[]) {
        if (counts[lvl] > best) {
          best = counts[lvl];
          ceiling = lvl;
        }
      }
      return { ceiling, counts };
    },

    async tallyAiVote(code) {
      const [room] = await sql`
        select id from rubric_cobuilder.rooms where code = ${code} limit 1
      `;
      if (!room) return null;
      const rows = (await sql`
        select level, count(*)::int as count
        from rubric_cobuilder.ai_use_votes
        where room_id = ${room.id}
        group by level
      `) as Array<{ level: number; count: number }>;
      const counts: Record<AiUseLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      for (const r of rows) counts[r.level as AiUseLevel] = r.count;
      let ceiling: AiUseLevel = 0;
      let best = -1;
      for (const lvl of [0, 1, 2, 3, 4] as AiUseLevel[]) {
        if (counts[lvl] > best) {
          best = counts[lvl];
          ceiling = lvl;
        }
      }
      await sql`
        update rubric_cobuilder.rooms
        set state = 'pledge', step_started_at = now(),
            timer_end = null, timer_duration = null
        where id = ${room.id}
      `;
      return { ceiling };
    },

    async upsertPledgeResponse(code, participantId, slotIndex, content) {
      const [room] = await sql`
        select id from rubric_cobuilder.rooms where code = ${code} limit 1
      `;
      if (!room) return null;
      const [row] = await sql`
        insert into rubric_cobuilder.pledge_responses (participant_id, room_id, slot_index, content)
        values (${participantId}, ${room.id}, ${slotIndex}, ${content})
        on conflict (participant_id, room_id, slot_index) do update
          set content = excluded.content, updated_at = now()
        returning id, participant_id, room_id, slot_index, content, updated_at
      `;
      return row as PledgeResponse;
    },

    async castPledgeResponseVote(participantId, pledgeResponseId) {
      const rows = await sql`
        insert into rubric_cobuilder.pledge_response_votes (participant_id, pledge_response_id)
        values (${participantId}, ${pledgeResponseId})
        on conflict (participant_id, pledge_response_id) do nothing
        returning id, participant_id, pledge_response_id, created_at
      `;
      if (rows.length === 0) {
        const [existing] = await sql`
          select id, participant_id, pledge_response_id, created_at
          from rubric_cobuilder.pledge_response_votes
          where participant_id = ${participantId} and pledge_response_id = ${pledgeResponseId}
          limit 1
        `;
        return (existing as PledgeResponseVote | undefined) ?? null;
      }
      return rows[0] as PledgeResponseVote;
    },

    async removePledgeResponseVote(participantId, pledgeResponseId) {
      const rows = await sql`
        delete from rubric_cobuilder.pledge_response_votes
        where participant_id = ${participantId} and pledge_response_id = ${pledgeResponseId}
        returning id
      `;
      return rows.length > 0;
    },

    async tallyPledgeVotes(code) {
      const [room] = await sql`
        select id from rubric_cobuilder.rooms where code = ${code} limit 1
      `;
      if (!room) return null;
      const rows = (await sql`
        select pr.id as response_id, pr.slot_index, pr.content, pr.updated_at,
               coalesce(vc.cnt, 0)::int as vote_count
        from rubric_cobuilder.pledge_responses pr
        left join (
          select pledge_response_id, count(*)::int as cnt
          from rubric_cobuilder.pledge_response_votes
          group by pledge_response_id
        ) vc on vc.pledge_response_id = pr.id
        where pr.room_id = ${room.id}
      `) as Array<{
        response_id: string;
        slot_index: number;
        content: string;
        updated_at: string;
        vote_count: number;
      }>;

      const bestBySlot = new Map<number, typeof rows[number]>();
      for (const r of rows) {
        if (!r.content.trim()) continue;
        const cur = bestBySlot.get(r.slot_index);
        if (
          !cur ||
          r.vote_count > cur.vote_count ||
          (r.vote_count === cur.vote_count && r.updated_at < cur.updated_at)
        ) {
          bestBySlot.set(r.slot_index, r);
        }
      }

      const winners: PledgeSlot[] = [];
      for (const w of bestBySlot.values()) {
        const [row] = await sql`
          insert into rubric_cobuilder.pledge_slots (room_id, slot_index, content)
          values (${room.id}, ${w.slot_index}, ${w.content})
          on conflict (room_id, slot_index) do update
            set content = excluded.content, updated_at = now()
          returning id, room_id, slot_index, content, updated_at
        `;
        winners.push(row as PledgeSlot);
      }

      await sql`
        update rubric_cobuilder.rooms
        set state = 'commit', step_started_at = now(),
            timer_end = null, timer_duration = null
        where id = ${room.id}
      `;

      return { winners };
    },

    async upsertPledgeSlot(roomCode, slotIndex, content) {
      const [room] = await sql`
        select id from rubric_cobuilder.rooms where code = ${roomCode} limit 1
      `;
      if (!room) return null;
      const [row] = await sql`
        insert into rubric_cobuilder.pledge_slots (room_id, slot_index, content)
        values (${room.id}, ${slotIndex}, ${content})
        on conflict (room_id, slot_index) do update
          set content = excluded.content, updated_at = now()
        returning id, room_id, slot_index, content, updated_at
      `;
      return row as PledgeSlot;
    },

    async setFacilitatorNudge(code, text) {
      const rows = await sql`
        update rubric_cobuilder.rooms
        set facilitator_nudge = ${text}
        where code = ${code}
        returning id, code, learning_outcome, project_description, state,
                  step_started_at, created_at,
                  facilitator_nudge, sample_artefact_title, sample_artefact_content
      `;
      return (rows[0] as Room | undefined) ?? null;
    },

    async setSampleArtefact(code, title, content) {
      const rows = await sql`
        update rubric_cobuilder.rooms
        set sample_artefact_title = ${title}, sample_artefact_content = ${content}
        where code = ${code}
        returning id, code, learning_outcome, project_description, state,
                  step_started_at, created_at,
                  facilitator_nudge, sample_artefact_title, sample_artefact_content,
                  timer_end, timer_duration
      `;
      return (rows[0] as Room | undefined) ?? null;
    },

    async setTimer(code, durationSeconds) {
      const rows = durationSeconds !== null
        ? await sql`
            update rubric_cobuilder.rooms
            set timer_end = now() + (${durationSeconds} * interval '1 second'),
                timer_duration = ${durationSeconds}
            where code = ${code}
            returning id, code, learning_outcome, project_description, state,
                      step_started_at, created_at,
                      facilitator_nudge, sample_artefact_title, sample_artefact_content,
                      timer_end, timer_duration
          `
        : await sql`
            update rubric_cobuilder.rooms
            set timer_end = null, timer_duration = null
            where code = ${code}
            returning id, code, learning_outcome, project_description, state,
                      step_started_at, created_at,
                      facilitator_nudge, sample_artefact_title, sample_artefact_content,
                      timer_end, timer_duration
          `;
      return (rows[0] as Room | undefined) ?? null;
    },

    async castScaleResponseVote(participantId, scaleResponseId) {
      const rows = await sql`
        insert into rubric_cobuilder.scale_response_votes (participant_id, scale_response_id)
        values (${participantId}, ${scaleResponseId})
        on conflict (participant_id, scale_response_id) do nothing
        returning id, participant_id, scale_response_id, created_at
      `;
      if (rows.length === 0) {
        const [existing] = await sql`
          select id, participant_id, scale_response_id, created_at
          from rubric_cobuilder.scale_response_votes
          where participant_id = ${participantId} and scale_response_id = ${scaleResponseId}
          limit 1
        `;
        return (existing as ScaleResponseVote | undefined) ?? null;
      }
      return rows[0] as ScaleResponseVote;
    },

    async removeScaleResponseVote(participantId, scaleResponseId) {
      const rows = await sql`
        delete from rubric_cobuilder.scale_response_votes
        where participant_id = ${participantId} and scale_response_id = ${scaleResponseId}
        returning id
      `;
      return rows.length > 0;
    },

    async tallyScaleResponseVotes(code, nextState) {
      const [room] = await sql`
        select id from rubric_cobuilder.rooms where code = ${code} limit 1
      `;
      if (!room) return null;
      const roomId = room.id as string;

      // fetch responses first (scale_responses exists from migration 004)
      const responseRows = (await sql`
        select sr.id as response_id, sr.criterion_id, sr.level, sr.descriptor, sr.updated_at
        from rubric_cobuilder.scale_responses sr
        join rubric_cobuilder.criteria c on c.id = sr.criterion_id
        where c.room_id = ${roomId} and c.status = 'selected'
      `) as Array<{
        response_id: string;
        criterion_id: string;
        level: number;
        descriptor: string;
        updated_at: string;
      }>;

      // vote counts — graceful if scale_response_votes table missing (migration 006 pending)
      const voteCounts = new Map<string, number>();
      if (responseRows.length > 0) {
        try {
          const voteRows = (await sql`
            select scale_response_id, count(*)::int as c
            from rubric_cobuilder.scale_response_votes
            group by scale_response_id
          `) as Array<{ scale_response_id: string; c: number }>;
          for (const v of voteRows) voteCounts.set(v.scale_response_id, v.c);
        } catch {
          // table not yet created — fall through with zero counts, earliest wins
        }
      }

      const rows = responseRows.map((r) => ({
        ...r,
        vote_count: voteCounts.get(r.response_id) ?? 0,
      }));

      // group by (criterion, level) and pick the winner
      const bestByKey = new Map<string, typeof rows[number]>();
      for (const r of rows) {
        if (!r.descriptor.trim()) continue;
        const key = `${r.criterion_id}:${r.level}`;
        const cur = bestByKey.get(key);
        if (
          !cur ||
          r.vote_count > cur.vote_count ||
          (r.vote_count === cur.vote_count && r.updated_at < cur.updated_at)
        ) {
          bestByKey.set(key, r);
        }
      }

      const winners: Scale[] = [];
      for (const w of bestByKey.values()) {
        const [row] = await sql`
          insert into rubric_cobuilder.scales (criterion_id, level, descriptor)
          values (${w.criterion_id}, ${w.level}, ${w.descriptor})
          on conflict (criterion_id, level) do update
            set descriptor = excluded.descriptor, updated_at = now()
          returning id, criterion_id, level, descriptor, updated_at
        `;
        winners.push(row as Scale);
      }

      await sql`
        update rubric_cobuilder.rooms
        set state = ${nextState}, step_started_at = now(),
            timer_end = null, timer_duration = null
        where id = ${roomId}
      `;

      return { winners };
    },

    async upsertAiProposal(participantId, roomCode, level, rationale) {
      const [room] = await sql`
        select id from rubric_cobuilder.rooms where code = ${roomCode} limit 1
      `;
      if (!room) return null;
      const [row] = await sql`
        insert into rubric_cobuilder.ai_use_proposals (room_id, participant_id, level, rationale)
        values (${room.id}, ${participantId}, ${level}, ${rationale})
        on conflict (room_id, participant_id) do update
          set level = excluded.level, rationale = excluded.rationale
        returning id, room_id, participant_id, level, rationale, created_at
      `;
      return row as AiUseProposal;
    },

    async castAiProposalVote(participantId, proposalId) {
      const rows = await sql`
        insert into rubric_cobuilder.ai_use_proposal_votes (participant_id, proposal_id)
        values (${participantId}, ${proposalId})
        on conflict (participant_id, proposal_id) do nothing
        returning id, participant_id, proposal_id, created_at
      `;
      if (rows.length === 0) {
        const [existing] = await sql`
          select id, participant_id, proposal_id, created_at
          from rubric_cobuilder.ai_use_proposal_votes
          where participant_id = ${participantId} and proposal_id = ${proposalId}
          limit 1
        `;
        return (existing as AiUseProposalVote | undefined) ?? null;
      }
      return rows[0] as AiUseProposalVote;
    },

    async removeAiProposalVote(participantId, proposalId) {
      const rows = await sql`
        delete from rubric_cobuilder.ai_use_proposal_votes
        where participant_id = ${participantId} and proposal_id = ${proposalId}
        returning id
      `;
      return rows.length > 0;
    },

    async tallyAiProposals(code) {
      const [room] = await sql`
        select id from rubric_cobuilder.rooms where code = ${code} limit 1
      `;
      if (!room) return null;
      const rows = (await sql`
        select p.level, count(pv.id)::int as c
        from rubric_cobuilder.ai_use_proposals p
        left join rubric_cobuilder.ai_use_proposal_votes pv on pv.proposal_id = p.id
        where p.room_id = ${room.id}
        group by p.level
      `) as Array<{ level: number; c: number }>;
      const counts: Record<AiUseLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      for (const r of rows) counts[r.level as AiUseLevel] = (counts[r.level as AiUseLevel] ?? 0) + r.c;
      let ceiling: AiUseLevel = 0;
      let best = -1;
      for (const lvl of [0, 1, 2, 3, 4] as AiUseLevel[]) {
        if (counts[lvl] > best) {
          best = counts[lvl];
          ceiling = lvl;
        }
      }
      return { ceiling, counts };
    },
  };
}

// ---------- factory ----------

const globalForStore = globalThis as unknown as { __rcbStore?: Store };
let cached: Store | null = null;

export function getStore(): Store {
  if (cached) return cached;
  const url = process.env.POSTGRES_URL;
  if (url) {
    cached = neonStore(url);
    // eslint-disable-next-line no-console
    console.log("[rubric-co-builder] store: neon");
  } else {
    if (!globalForStore.__rcbStore) {
      globalForStore.__rcbStore = memoryStore();
      // eslint-disable-next-line no-console
      console.log(
        "[rubric-co-builder] store: in-memory (POSTGRES_URL not set — demo mode)",
      );
    }
    cached = globalForStore.__rcbStore;
  }
  return cached;
}
