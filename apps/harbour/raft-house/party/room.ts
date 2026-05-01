import type { Party, Connection } from "partykit/server";
import type {
  RoomState,
  ClientMessage,
  FacilitatorMessage,
  ParticipantMessage,
  Participant,
  ServerBroadcast,
} from "../lib/types";
import { TEMPO_DEFAULT_DURATION_MS } from "../lib/types";

function defaultState(roomId: string): RoomState {
  return {
    code: roomId,
    facilitatorId: null,
    mode: "sync",
    displayMode: "screenless",
    ageLevel: "professional",
    status: "lobby",
    activities: [],
    currentActivityIndex: 0,
    participants: {},
    timer: null,
    createdAt: Date.now(),
    resultsRevealed: false,
  };
}

export default class RoomServer {
  state: RoomState;
  facilitatorConn: Connection | null = null;

  constructor(public room: Party) {
    this.state = defaultState(room.id);
  }

  async onStart() {
    const stored = await this.room.storage.get<RoomState>("state");
    if (stored) this.state = stored;
  }

  async onConnect(conn: Connection) {
    const url = new URL(conn.uri, "https://localhost");
    const role = url.searchParams.get("role");
    const name = url.searchParams.get("name") || "anonymous";

    if (role === "facilitator") {
      this.facilitatorConn = conn;
      this.state.facilitatorId = conn.id;
    } else {
      const participant: Participant = {
        id: conn.id,
        displayName: name,
        role: (url.searchParams.get("participantRole") as Participant["role"]) || "participant",
        connectionStatus: "connected",
        currentActivityIndex: 0,
        responses: {},
        lastSeen: Date.now(),
      };
      this.state.participants[conn.id] = participant;
      this.broadcast({ type: "participant-joined", participant });
    }

    // send full state + assigned connection ID to the new connection
    conn.send(JSON.stringify({ type: "state-update", state: this.state, yourId: conn.id } satisfies ServerBroadcast));
    await this.persist();
  }

  async onMessage(message: string, sender: Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }

    if (msg.role === "facilitator") {
      // only the actual facilitator connection can issue facilitator commands
      if (sender.id !== this.state.facilitatorId) return;
      this.handleFacilitator(msg, sender);
    } else {
      this.handleParticipant(msg, sender);
    }

    await this.persist();
  }

  onClose(conn: Connection) {
    if (conn.id === this.state.facilitatorId) {
      this.facilitatorConn = null;
      // don't end session — facilitator may reconnect
    } else if (this.state.participants[conn.id]) {
      this.state.participants[conn.id].connectionStatus = "disconnected";
      this.broadcast({ type: "participant-left", participantId: conn.id });
    }
  }

  // ── facilitator commands ─────────────────────────────────────

  private handleFacilitator(msg: FacilitatorMessage, _sender: Connection) {
    switch (msg.type) {
      case "setup": {
        if (this.state.activities.length === 0) {
          this.state.activities = msg.activities;
          this.state.status = "active";
          this.state.currentActivityIndex = 0;
          if (msg.displayMode) this.state.displayMode = msg.displayMode;
          if (msg.ageLevel) this.state.ageLevel = msg.ageLevel;
          this.broadcastState();
        }
        break;
      }

      case "advance": {
        const next = this.state.currentActivityIndex + 1;
        if (next < this.state.activities.length) {
          this.state.currentActivityIndex = next;
          this.state.resultsRevealed = false;
          this.state.timer = null;
          const newActivity = this.state.activities[this.state.currentActivityIndex];
          if (newActivity?.mechanic?.tempo) {
            const autoMs = TEMPO_DEFAULT_DURATION_MS[newActivity.mechanic.tempo];
            if (autoMs) {
              this.state.timer = {
                type: "countdown",
                durationMs: autoMs,
                startedAt: Date.now(),
              };
            }
          }
          this.broadcast({
            type: "activity-changed",
            activityIndex: next,
            activity: this.state.activities[next],
          });
        }
        break;
      }

      case "goto": {
        if (msg.activityIndex >= 0 && msg.activityIndex < this.state.activities.length) {
          this.state.currentActivityIndex = msg.activityIndex;
          this.state.resultsRevealed = false;
          this.state.timer = null;
          const newActivity = this.state.activities[this.state.currentActivityIndex];
          if (newActivity?.mechanic?.tempo) {
            const autoMs = TEMPO_DEFAULT_DURATION_MS[newActivity.mechanic.tempo];
            if (autoMs) {
              this.state.timer = {
                type: "countdown",
                durationMs: autoMs,
                startedAt: Date.now(),
              };
            }
          }
          this.broadcast({
            type: "activity-changed",
            activityIndex: msg.activityIndex,
            activity: this.state.activities[msg.activityIndex],
          });
        }
        break;
      }

      case "pause":
        this.state.status = "paused";
        if (this.state.timer && !this.state.timer.pausedAt) {
          this.state.timer.pausedAt = Date.now();
        }
        this.broadcastState();
        break;

      case "resume":
        this.state.status = "active";
        if (this.state.timer?.pausedAt) {
          const elapsed = this.state.timer.pausedAt - this.state.timer.startedAt;
          this.state.timer.startedAt = Date.now() - elapsed;
          this.state.timer.pausedAt = undefined;
        }
        this.broadcastState();
        break;

      case "set-mode":
        this.state.mode = msg.mode;
        this.broadcastState();
        break;

      case "set-age-level":
        this.state.ageLevel = msg.ageLevel;
        this.broadcastState();
        break;

      case "set-display-mode":
        this.state.displayMode = msg.displayMode;
        this.broadcastState();
        break;

      case "reveal-results": {
        this.state.resultsRevealed = true;
        const activity = this.state.activities[this.state.currentActivityIndex];
        if (activity) {
          const responses: Record<string, unknown> = {};
          for (const [pid, p] of Object.entries(this.state.participants)) {
            if (p.responses[activity.id] !== undefined) {
              responses[pid] = p.responses[activity.id];
            }
          }
          this.broadcast({ type: "results-revealed", activityId: activity.id, responses });
        }
        break;
      }

      case "timer-start":
        this.state.timer = {
          type: "countdown",
          durationMs: msg.durationMs,
          startedAt: Date.now(),
        };
        this.broadcast({ type: "timer-sync", timer: this.state.timer });
        break;

      case "timer-pause":
        if (this.state.timer && !this.state.timer.pausedAt) {
          this.state.timer.pausedAt = Date.now();
          this.broadcast({ type: "timer-sync", timer: this.state.timer });
        }
        break;

      case "timer-clear":
        this.state.timer = null;
        this.broadcast({ type: "timer-sync", timer: null });
        break;

      case "send-hint":
        if (msg.participantId) {
          // send to specific participant
          for (const conn of this.room.getConnections()) {
            if (conn.id === msg.participantId) {
              conn.send(JSON.stringify({ type: "hint", hint: msg.hint } satisfies ServerBroadcast));
            }
          }
        } else {
          this.broadcast({ type: "hint", hint: msg.hint });
        }
        break;

      case "kick":
        delete this.state.participants[msg.participantId];
        for (const conn of this.room.getConnections()) {
          if (conn.id === msg.participantId) conn.close();
        }
        this.broadcastState();
        break;

      case "end-session":
        this.state.status = "completed";
        this.broadcast({ type: "session-ended" });
        break;
    }
  }

  // ── participant commands ─────────────────────────────────────

  private handleParticipant(msg: ParticipantMessage & { participantId: string }, sender: Connection) {
    const participant = this.state.participants[sender.id];
    if (!participant) return;

    switch (msg.type) {
      case "submit": {
        participant.responses[msg.activityId] = msg.response;
        participant.lastSeen = Date.now();
        // notify facilitator of submission count update
        this.broadcastState();
        break;
      }

      case "navigate": {
        if (this.state.mode === "async") {
          participant.currentActivityIndex = msg.activityIndex;
          this.broadcastState();
        }
        break;
      }

      case "request-hint": {
        // forward to facilitator
        if (this.facilitatorConn) {
          this.facilitatorConn.send(
            JSON.stringify({
              type: "hint",
              hint: `${participant.displayName} is requesting a hint`,
            } satisfies ServerBroadcast),
          );
        }
        break;
      }
    }
  }

  // ── helpers ──────────────────────────────────────────────────

  private broadcast(msg: ServerBroadcast) {
    this.room.broadcast(JSON.stringify(msg));
  }

  private broadcastState() {
    this.broadcast({ type: "state-update", state: this.state });
  }

  private async persist() {
    await this.room.storage.put("state", this.state);
  }
}
