import type { Transport, TransportMessage, TransportRole } from '@/transport/transport';

export class SocketTransport implements Transport {
  public clientId: string;
  private ws?: WebSocket;
  private handlers = new Set<(m: TransportMessage) => void>();
  private url: string;
  private queue: TransportMessage[] = [];

  constructor(clientId: string, url = 'ws://localhost:8787') {
    this.clientId = clientId;
    this.url = url;
  }

  async connect(sessionId: string, role: TransportRole, clientId: string): Promise<void> {
    this.clientId = clientId;
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
    this.ws?.close();
    this.ws = undefined;
    this.handlers.clear();
  }
}
