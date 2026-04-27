// values-auction ws relay — cloudflare worker + durable object
//
// one durable object per session (keyed by session code).
// relays {type, payload, at, sender} messages between connected clients.
// caches the latest `state` payload so reconnecting participants can hydrate
// even when no facilitator is online.

export interface Env {
  SESSION: DurableObjectNamespace;
}

interface RelayMessage {
  type: 'action' | 'state' | 'hello' | 'request-state';
  payload: unknown;
  at: number;
  sender: string;
}

interface ClientMeta {
  sessionId: string;
  role: string;
  id: string;
}

const corsHeaders: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('values-auction relay — connect via /ws?session=<code>', {
        headers: { 'content-type': 'text/plain', ...corsHeaders },
      });
    }

    if (url.pathname !== '/ws') {
      return new Response('not found', { status: 404, headers: corsHeaders });
    }

    const sessionId = url.searchParams.get('session');
    if (!sessionId) {
      return new Response('missing session', { status: 400, headers: corsHeaders });
    }

    const upgrade = request.headers.get('upgrade');
    if (upgrade !== 'websocket') {
      return new Response('expected websocket upgrade', { status: 426, headers: corsHeaders });
    }

    const id = env.SESSION.idFromName(sessionId);
    const stub = env.SESSION.get(id);
    return stub.fetch(request);
  },
};

export class SessionRoom {
  private state: DurableObjectState;
  private clients = new Map<WebSocket, ClientMeta>();
  private latestState: RelayMessage | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      const cached = await this.state.storage.get<RelayMessage>('latest-state');
      if (cached) this.latestState = cached;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session') ?? 'default';
    const role = url.searchParams.get('role') ?? 'participant';
    const id = url.searchParams.get('id') ?? `c_${crypto.randomUUID().slice(0, 8)}`;

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();

    const meta: ClientMeta = { sessionId, role, id };
    this.clients.set(server, meta);

    server.addEventListener('message', (event) => {
      const raw = typeof event.data === 'string' ? event.data : '';
      if (!raw) return;
      let parsed: RelayMessage;
      try {
        parsed = JSON.parse(raw) as RelayMessage;
      } catch {
        return;
      }

      // cache the latest authoritative state for late joiners
      if (parsed.type === 'state') {
        this.latestState = parsed;
        this.state.storage.put('latest-state', parsed).catch(() => {});
      }

      // request-state: if we have cached state, serve it directly to the
      // requester. peers (incl. facilitator) still receive the request and
      // can respond with fresher state.
      if (parsed.type === 'request-state' && this.latestState) {
        try {
          server.send(JSON.stringify(this.latestState));
        } catch {
          // ignore send errors — the broadcast below will catch live peers
        }
      }

      this.broadcast(raw, server);
    });

    const cleanup = () => {
      this.clients.delete(server);
    };
    server.addEventListener('close', cleanup);
    server.addEventListener('error', cleanup);

    return new Response(null, { status: 101, webSocket: client });
  }

  private broadcast(raw: string, sender: WebSocket) {
    for (const peer of this.clients.keys()) {
      if (peer === sender) continue;
      try {
        peer.send(raw);
      } catch {
        this.clients.delete(peer);
      }
    }
  }
}
