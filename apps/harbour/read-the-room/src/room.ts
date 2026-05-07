import { DurableObject } from "cloudflare:workers";

// Per-trio state. One Room DO instance per room code. (read the room — w.v)
// Storage is SQLite-backed (see wrangler.jsonc migrations); we use the KV
// shim via ctx.storage for simplicity — state is small and read in full
// on every event.

export interface Env {
  ROOM: DurableObjectNamespace;
}

type Position = 1 | 2 | 3;
type Phase =
  | "lobby"
  | "difficulty"
  | "roundIntro"
  | "prompt"
  | "wait"
  | "reveal"
  | "reflect"
  | "solve"
  | "roundDone"
  | "close";
type Difficulty = "slow" | "medium" | "fast";

interface Card {
  id: number;
  name: string;
  label: string;
  svg: string;
}

interface RoomState {
  code: string;
  createdAt: number;
  positions: Record<Position, string | null>;
  difficulty: Difficulty | null;
  round: 0 | 1 | 2;
  currentPromptIdx: number | null;
  usedPrompts: number[];
  hands: Record<Position, Card[]>;
  cardPicks: Record<Position, number | null>;
  revealed: boolean;
  phase: Phase;
}

type ClientMsg =
  | { t: "hello"; clientId: string; position?: Position | null }
  | { t: "claim_position"; position: Position }
  | { t: "release_position" }
  | { t: "set_difficulty"; difficulty: Difficulty }
  | { t: "advance"; to: Phase }
  | { t: "draw_prompt"; hands: Record<Position, Card[]>; promptIdx: number }
  | { t: "pick_card"; cardId: number }
  | { t: "change_card" }
  | { t: "reveal" }
  | { t: "next_round" }
  | { t: "play_again" };

interface Attachment {
  clientId: string;
  position: Position | null;
}

const IDLE_MS = 60 * 60 * 1000; // 60 min — alarm fires this far after last activity

function emptyState(code: string): RoomState {
  return {
    code,
    createdAt: Date.now(),
    positions: { 1: null, 2: null, 3: null },
    difficulty: null,
    round: 0,
    currentPromptIdx: null,
    usedPrompts: [],
    hands: { 1: [], 2: [], 3: [] },
    cardPicks: { 1: null, 2: null, 3: null },
    revealed: false,
    phase: "lobby",
  };
}

function allPicked(state: RoomState): boolean {
  return state.cardPicks[1] !== null && state.cardPicks[2] !== null && state.cardPicks[3] !== null;
}

export class Room extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/exists")) {
      const state = await this.getState();
      return Response.json({ exists: state !== null });
    }

    if (url.pathname.endsWith("/init")) {
      const code = url.searchParams.get("code") ?? "";
      const existing = await this.getState();
      if (!existing) {
        await this.ctx.storage.put<RoomState>("state", emptyState(code));
      }
      await this.bumpAlarm();
      return Response.json({ ok: true });
    }

    if (url.pathname.endsWith("/wipe")) {
      // Admin-triggered force-close. We mimic the alarm() path: kick every
      // socket with code 4404 (which the client already handles by clearing
      // its localStorage and bouncing to the enter screen) then drop all
      // storage so the room can't be re-entered.
      const had = (await this.getState()) !== null;
      for (const ws of this.ctx.getWebSockets()) {
        try { ws.close(4404, "room wiped"); } catch {}
      }
      await this.ctx.storage.deleteAll();
      return Response.json({ ok: true, wiped: had });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const clientId = url.searchParams.get("clientId") ?? crypto.randomUUID();
    const savedPosRaw = url.searchParams.get("position");
    const savedPos =
      savedPosRaw === "1" || savedPosRaw === "2" || savedPosRaw === "3"
        ? (Number(savedPosRaw) as Position)
        : null;

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    this.ctx.acceptWebSocket(server);
    const attachment: Attachment = { clientId, position: null };
    server.serializeAttachment(attachment);

    let state = await this.getState();
    if (!state) {
      // Code not yet initialised — refuse the connection.
      server.close(4404, "room not found");
      return new Response(null, { status: 101, webSocket: client });
    }

    // Reattach to a saved seat if it's still ours / still vacant.
    if (savedPos && state.positions[savedPos] === clientId) {
      attachment.position = savedPos;
      server.serializeAttachment(attachment);
    } else if (savedPos && state.positions[savedPos] === null) {
      state.positions[savedPos] = clientId;
      attachment.position = savedPos;
      server.serializeAttachment(attachment);
      await this.setState(state);
    }

    // Send initial snapshot directly to this socket (don't broadcast).
    server.send(JSON.stringify({ t: "you", clientId, position: attachment.position }));
    server.send(JSON.stringify({ t: "state", state }));
    await this.bumpAlarm();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    let msg: ClientMsg;
    try {
      msg = JSON.parse(text) as ClientMsg;
    } catch {
      return;
    }

    const att = ws.deserializeAttachment() as Attachment;
    const state = await this.getState();
    if (!state) return;

    switch (msg.t) {
      case "hello":
        // Re-hello after socket open — already handled at connect, no-op.
        break;

      case "claim_position": {
        const p = msg.position;
        if (state.positions[p] && state.positions[p] !== att.clientId) {
          ws.send(JSON.stringify({ t: "error", code: "seat_taken", position: p }));
          return;
        }
        // Vacate any previous seat for this client.
        for (const pos of [1, 2, 3] as Position[]) {
          if (state.positions[pos] === att.clientId) state.positions[pos] = null;
        }
        state.positions[p] = att.clientId;
        att.position = p;
        ws.serializeAttachment(att);
        ws.send(JSON.stringify({ t: "you", clientId: att.clientId, position: p }));
        break;
      }

      case "release_position": {
        for (const pos of [1, 2, 3] as Position[]) {
          if (state.positions[pos] === att.clientId) state.positions[pos] = null;
        }
        att.position = null;
        ws.serializeAttachment(att);
        ws.send(JSON.stringify({ t: "you", clientId: att.clientId, position: null }));
        break;
      }

      case "set_difficulty":
        state.difficulty = msg.difficulty;
        break;

      case "advance":
        state.phase = msg.to;
        break;

      case "draw_prompt":
        // Client deals from PROMPTS + DECK because those are static and
        // bundled in the HTML; only the resulting selection is shipped to
        // the server. Idempotent: first draw per round wins.
        if (state.currentPromptIdx === null) {
          state.currentPromptIdx = msg.promptIdx;
          state.usedPrompts = state.usedPrompts.includes(msg.promptIdx)
            ? state.usedPrompts
            : [...state.usedPrompts, msg.promptIdx];
          state.hands = msg.hands;
          state.cardPicks = { 1: null, 2: null, 3: null };
          state.revealed = false;
          state.phase = "prompt";
        }
        break;

      case "pick_card":
        if (att.position) {
          state.cardPicks[att.position] = msg.cardId;
          // Auto-advance to wait once everyone's picked. Stay on prompt
          // otherwise — keeps revisions cheap.
          if (state.phase === "prompt" && allPicked(state)) state.phase = "wait";
        }
        break;

      case "change_card":
        if (att.position) {
          state.cardPicks[att.position] = null;
          if (state.phase === "wait") state.phase = "prompt";
        }
        break;

      case "reveal":
        state.revealed = true;
        state.phase = "reveal";
        break;

      case "next_round":
        if (state.round < 2) {
          state.round = (state.round + 1) as 0 | 1 | 2;
          state.currentPromptIdx = null;
          state.hands = { 1: [], 2: [], 3: [] };
          state.cardPicks = { 1: null, 2: null, 3: null };
          state.revealed = false;
          state.phase = "roundIntro";
        } else {
          // After round 3's solve, go to the echo recap screen.
          state.phase = "roundDone";
        }
        break;

      case "play_again": {
        // Same room, fresh game — keep code + positions, drop everything else.
        const fresh = emptyState(state.code);
        fresh.createdAt = state.createdAt;
        fresh.positions = state.positions;
        Object.assign(state, fresh);
        break;
      }
    }

    await this.setState(state);
    await this.broadcast({ t: "state", state });
    await this.bumpAlarm();
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    // Vacate the seat so other devices can re-claim it. Position metadata
    // also lives in localStorage on the original device — if it reconnects
    // before someone else takes the seat, it'll re-claim cleanly.
    const att = ws.deserializeAttachment() as Attachment | null;
    if (att?.position) {
      const state = await this.getState();
      if (state && state.positions[att.position] === att.clientId) {
        state.positions[att.position] = null;
        await this.setState(state);
        await this.broadcast({ t: "state", state });
      }
    }
    try {
      ws.close(code, reason);
    } catch {
      // already closed
    }
  }

  async webSocketError(_ws: WebSocket, error: unknown): Promise<void> {
    console.error("[feel-room] ws error", error);
  }

  async alarm(): Promise<void> {
    // Idle eviction. If anyone reconnects after this, the room is gone and
    // the WS handshake will return 4404.
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(4408, "room idle");
      } catch {}
    }
    await this.ctx.storage.deleteAll();
  }

  private async getState(): Promise<RoomState | null> {
    return (await this.ctx.storage.get<RoomState>("state")) ?? null;
  }

  private async setState(state: RoomState): Promise<void> {
    await this.ctx.storage.put("state", state);
  }

  private async bumpAlarm(): Promise<void> {
    await this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
  }

  private async broadcast(payload: unknown): Promise<void> {
    const text = JSON.stringify(payload);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(text);
      } catch {
        // socket gone; close handler will clean up
      }
    }
  }
}
