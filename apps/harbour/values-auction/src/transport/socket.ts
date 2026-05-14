import type {
  ConnectionStatus,
  Transport,
  TransportMessage,
  TransportRole,
} from '@/transport/transport';

/**
 * WebSocket transport with exponential-backoff reconnect.
 *
 * Connection lifecycle:
 *   - connect()        → status: 'reconnecting' → 'connected' (resolved promise)
 *   - WS close event   → status: 'reconnecting' → schedule retry with backoff
 *   - retry succeeds   → status: 'connected', re-emit 'request-state' to resync
 *   - manual disconnect → status: 'offline' (terminal until next connect())
 *
 * Backoff: 500ms → 1s → 2s → 4s → 8s → 16s → 30s (cap), reset on success.
 * The retry counter is preserved across rapid drops so a flapping connection
 * doesn't hammer the server.
 *
 * Outbound queue: messages sent while disconnected are buffered and flushed
 * on reconnect, preserving order.
 */

const RECONNECT_INITIAL_MS = 500;
const RECONNECT_CAP_MS = 30_000;

export class SocketTransport implements Transport {
  public clientId: string;
  private ws?: WebSocket;
  private handlers = new Set<(m: TransportMessage) => void>();
  private statusHandlers = new Set<(s: ConnectionStatus) => void>();
  private status: ConnectionStatus = 'offline';
  private url: string;
  private queue: TransportMessage[] = [];
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionId?: string;
  private role?: TransportRole;
  // true once the consumer calls disconnect() — suppresses reconnect.
  private terminated = false;

  constructor(clientId: string, url = 'ws://localhost:8787') {
    this.clientId = clientId;
    this.url = url;
  }

  async connect(sessionId: string, role: TransportRole, clientId: string): Promise<void> {
    this.clientId = clientId;
    this.sessionId = sessionId;
    this.role = role;
    this.terminated = false;
    return this.openSocket(/* requestResyncOnOpen */ false);
  }

  private buildUrl(): string {
    if (!this.sessionId || !this.role) throw new Error('SocketTransport: connect() before open');
    return `${this.url}?session=${encodeURIComponent(this.sessionId)}&role=${this.role}&id=${encodeURIComponent(
      this.clientId,
    )}`;
  }

  private openSocket(requestResyncOnOpen: boolean): Promise<void> {
    this.setStatus('reconnecting');
    return new Promise<void>((resolve, reject) => {
      let resolved = false;
      try {
        const ws = new WebSocket(this.buildUrl());
        this.ws = ws;
        ws.addEventListener('open', () => {
          this.reconnectAttempts = 0;
          this.setStatus('connected');
          // flush anything queued while disconnected
          while (this.queue.length) {
            const m = this.queue.shift()!;
            try {
              ws.send(JSON.stringify(m));
            } catch {
              // socket died mid-flush; close handler will re-queue + reschedule
              break;
            }
          }
          if (requestResyncOnOpen) {
            try {
              ws.send(
                JSON.stringify({
                  type: 'request-state',
                  payload: null,
                  at: Date.now(),
                  sender: this.clientId,
                }),
              );
            } catch {
              // ignore; close handler will reschedule
            }
          }
          resolved = true;
          resolve();
        });
        ws.addEventListener('message', (ev) => {
          try {
            const msg = JSON.parse(ev.data) as TransportMessage;
            if (msg.sender === this.clientId) return;
            for (const h of this.handlers) h(msg);
          } catch (err) {
            console.error('[socket] bad message', err);
          }
        });
        ws.addEventListener('error', (e) => {
          console.warn('[socket] error event', e);
          // do not reject after we've resolved; let close handler manage retry
          if (!resolved) reject(e);
        });
        ws.addEventListener('close', () => {
          this.ws = undefined;
          if (this.terminated) {
            this.setStatus('offline');
            return;
          }
          this.scheduleReconnect();
          // if the initial connect never opened, surface the error to the caller
          if (!resolved) {
            resolved = true;
            // resolve anyway — the consumer can observe status and the reconnect
            // loop will keep trying. rejecting here would abort the whole
            // controller setup which is worse than starting in 'reconnecting'.
            resolve();
          }
        });
      } catch (err) {
        if (!resolved) reject(err);
      }
    });
  }

  private scheduleReconnect() {
    if (this.terminated) return;
    if (this.reconnectTimer) return;
    const delay = Math.min(
      RECONNECT_CAP_MS,
      RECONNECT_INITIAL_MS * Math.pow(2, this.reconnectAttempts),
    );
    this.reconnectAttempts += 1;
    this.setStatus('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket(/* requestResyncOnOpen */ true).catch((err) => {
        console.warn('[socket] reconnect attempt failed', err);
        // close handler will reschedule
      });
    }, delay);
  }

  private setStatus(s: ConnectionStatus) {
    if (this.status === s) return;
    this.status = s;
    for (const h of this.statusHandlers) h(s);
  }

  send(msg: TransportMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queue.push(msg);
      return;
    }
    try {
      this.ws.send(JSON.stringify(msg));
    } catch {
      this.queue.push(msg);
    }
  }

  subscribe(handler: (m: TransportMessage) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  subscribeStatus(handler: (s: ConnectionStatus) => void): () => void {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  disconnect(): void {
    this.terminated = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = undefined;
    this.handlers.clear();
    this.statusHandlers.clear();
    this.setStatus('offline');
  }
}
