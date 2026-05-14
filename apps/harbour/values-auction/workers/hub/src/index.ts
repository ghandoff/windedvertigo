import { DurableObject } from 'cloudflare:workers';

export interface Env {
  HUB_SESSION: DurableObjectNamespace;
  EVENTS_KV: KVNamespace;
}

// shape of every transport message — kept in sync with src/transport/transport.ts
// in the SPA. the DO only cares about a few types; everything else is opaque
// JSON to be relayed verbatim.
interface TransportMessage {
  type: 'action' | 'state' | 'hello' | 'request-state' | 'snapshot';
  payload: unknown;
  at: number;
  sender: string;
}

interface Attachment {
  sessionId: string;
  role: string;
  clientId: string;
}

// SQLite storage keys — kept narrow + namespaced.
const STORAGE_SNAPSHOT_KEY = 'snapshot:v1';

/**
 * Hub for a live values-auction session.
 *
 * Architecture (Phase B-min, 2026-05-14):
 *   - Relay role (legacy): forward action/state/hello messages between peers
 *     in the same session. Connections use hibernation via acceptWebSocket.
 *   - Snapshot store (new): the facilitator periodically uploads a full
 *     Session snapshot via { type: 'snapshot' }. The DO stores it in
 *     SQLite-backed `state.storage` and DOES NOT relay it. When any peer
 *     sends { type: 'request-state' }, the DO answers directly from
 *     storage instead of forwarding to all peers and waiting for the
 *     facilitator to respond. This removes the facilitator as the single
 *     point of failure for late-joiner state — even if the facilitator's
 *     browser closes mid-session, joining clients still receive the last
 *     known good snapshot.
 *
 * Compatibility:
 *   - Old clients (pre-Phase-B) don't send 'snapshot' messages; the DO
 *     just won't have one in storage and will fall back to relaying
 *     'request-state' to peers, matching previous behaviour.
 *   - Old clients ignore unknown message types (their handler doesn't
 *     match 'snapshot'), so a mid-deploy mixed fleet is safe.
 */
export class HubSession extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const upgrade = request.headers.get('Upgrade');
    if (upgrade !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session') ?? 'default';
    const role = url.searchParams.get('role') ?? 'participant';
    const clientId = url.searchParams.get('id') ?? crypto.randomUUID();

    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server, [sessionId]);
    server.serializeAttachment({ sessionId, role, clientId } satisfies Attachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);
    const { sessionId, role, clientId } = ws.deserializeAttachment() as Attachment;

    let parsed: TransportMessage | null = null;
    try {
      parsed = JSON.parse(raw) as TransportMessage;
    } catch {
      // bad JSON — ignore. don't relay garbage.
      return;
    }

    // ── snapshot path: facilitator → DO storage, NOT relayed ──────────────
    if (parsed.type === 'snapshot') {
      // defence in depth: only facilitators should be uploading snapshots.
      // a malicious or buggy participant client would have its writes
      // silently dropped here. participants still benefit from the stored
      // snapshot when reconnecting.
      if (role !== 'facilitator') return;
      // store as a string blob to avoid SQLite type fragility with deep JSON.
      // payload is a Session object — opaque to the DO.
      await this.ctx.storage.put(STORAGE_SNAPSHOT_KEY, raw);
      return;
    }

    // ── request-state path: answer from storage when we have one ─────────
    if (parsed.type === 'request-state') {
      const stored = await this.ctx.storage.get<string>(STORAGE_SNAPSHOT_KEY);
      if (stored) {
        // synthesise a 'state' response sourced from the stored snapshot.
        // we send only to the requesting socket, not the whole session.
        try {
          const payload = JSON.parse(stored) as TransportMessage;
          const response: TransportMessage = {
            type: 'state',
            payload: payload.payload,
            at: Date.now(),
            sender: 'hub',
          };
          ws.send(JSON.stringify(response));
        } catch {
          // stored snapshot is corrupted — drop it and fall through to
          // relay so the facilitator can re-answer.
          await this.ctx.storage.delete(STORAGE_SNAPSHOT_KEY);
          this.relayToOthers(ws, sessionId, raw);
        }
        return;
      }
      // no snapshot yet: relay the request to peers; facilitator will answer.
      this.relayToOthers(ws, sessionId, raw);
      return;
    }

    // ── default path: log + relay (actions, legacy state broadcasts, hello) ─
    // best-effort KV log, non-blocking.
    const logKey = `events:${sessionId}:${Date.now()}:${clientId.slice(0, 8)}`;
    this.ctx.waitUntil(
      this.env.EVENTS_KV.put(
        logKey,
        JSON.stringify({ sessionId, at: Date.now(), from: clientId, role, msg: parsed }),
      ),
    );

    this.relayToOthers(ws, sessionId, raw);
  }

  private relayToOthers(sender: WebSocket, sessionId: string, raw: string): void {
    for (const peer of this.ctx.getWebSockets(sessionId)) {
      if (peer !== sender) {
        try {
          peer.send(raw);
        } catch {
          // peer disconnected mid-send
        }
      }
    }
  }

  async webSocketError(_ws: WebSocket, error: unknown): Promise<void> {
    console.error('[hub] WebSocket error:', error);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    ws.close(code, reason);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Upgrade, Connection',
        },
      });
    }

    const sessionId = new URL(request.url).searchParams.get('session') ?? 'default';
    const stub = env.HUB_SESSION.get(env.HUB_SESSION.idFromName(sessionId));
    return stub.fetch(request);
  },
} satisfies ExportedHandler<Env>;
