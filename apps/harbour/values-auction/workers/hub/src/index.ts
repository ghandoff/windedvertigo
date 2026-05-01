import { DurableObject } from 'cloudflare:workers';

export interface Env {
  HUB_SESSION: DurableObjectNamespace;
  EVENTS_KV: KVNamespace;
}

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
    server.serializeAttachment({ sessionId, role, clientId });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);
    const { sessionId, role, clientId } = ws.deserializeAttachment() as {
      sessionId: string;
      role: string;
      clientId: string;
    };

    // Persist event to KV (best-effort, non-blocking)
    const logKey = `events:${sessionId}:${Date.now()}:${clientId.slice(0, 8)}`;
    this.ctx.waitUntil(
      this.env.EVENTS_KV.put(
        logKey,
        JSON.stringify({ sessionId, at: Date.now(), from: clientId, role, msg: JSON.parse(raw) }),
      ),
    );

    // Broadcast to all other peers in this session
    for (const peer of this.ctx.getWebSockets(sessionId)) {
      if (peer !== ws) {
        try {
          peer.send(raw);
        } catch {
          // peer disconnected mid-send
        }
      }
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
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
