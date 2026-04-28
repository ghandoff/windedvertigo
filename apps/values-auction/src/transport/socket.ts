import type { Transport, TransportMessage, TransportRole } from '@/transport/transport';

export class SocketTransport implements Transport {
  public clientId: string;
  private ws?: WebSocket;
  private handlers = new Set<(m: TransportMessage) => void>();
  private url: string;
  private queue: TransportMessage[] = [];
  private sessionId?: string;
  private role?: TransportRole;
  private reconnectAttempts = 0;
  private stopped = false;

  constructor(clientId: string, url = 'ws://localhost:8787') {
    this.clientId = clientId;
    this.url = url;
  }

  async connect(sessionId: string, role: TransportRole, clientId: string): Promise<void> {
    this.sessionId = sessionId;
    this.role = role;
    this.clientId = clientId;
    this.stopped = false;
    const full = `${this.url}?session=${encodeURIComponent(sessionId)}&role=${role}&id=${encodeURIComponent(
      clientId,
    )}`;
    await new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(full);
        this.ws.addEventListener('open', () => {
          while (this.queue.length) {
            const m = this.queue.shift()!;
            this.ws?.send(JSON.stringify(m));
          }
          resolve();
        });
        this.ws.addEventListener('close', () => this.scheduleReconnect());
        this.ws.addEventListener('error', (e) => reject(e));
        this.ws.addEventListener('message', (ev) => {
          try {
            const msg = JSON.parse(ev.data) as TransportMessage;
            if (msg.sender === this.clientId) return;
            for (const h of this.handlers) h(msg);
          } catch (err) {
            console.error('bad socket message', err);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private scheduleReconnect() {
    if (this.stopped || !this.sessionId || !this.role) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts++;
    setTimeout(() => this.reconnect(), delay);
  }

  private async reconnect() {
    if (this.stopped || !this.sessionId || !this.role) return;
    try {
      await this.connect(this.sessionId, this.role, this.clientId);
      this.reconnectAttempts = 0;
      if (this.role !== 'facilitator') {
        this.send({
          type: 'request-state',
          payload: null,
          at: Date.now(),
          sender: this.clientId,
        });
      }
    } catch {
      this.scheduleReconnect();
    }
  }

  send(msg: TransportMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queue.push(msg);
      return;
    }
    this.ws.send(JSON.stringify(msg));
  }

  subscribe(handler: (m: TransportMessage) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  disconnect(): void {
    this.stopped = true;
    this.ws?.close();
    this.ws = undefined;
    this.handlers.clear();
  }
}
