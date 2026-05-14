import type {
  ConnectionStatus,
  Transport,
  TransportMessage,
  TransportRole,
} from '@/transport/transport';

export class BroadcastTransport implements Transport {
  public clientId: string;
  private channel?: BroadcastChannel;
  private handlers = new Set<(m: TransportMessage) => void>();
  // BroadcastChannel is in-process and never "disconnects" — surface a
  // stable 'connected' status so consumers don't need to special-case it.
  private status: ConnectionStatus = 'connected';

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  async connect(sessionId: string, _role: TransportRole, clientId: string): Promise<void> {
    this.clientId = clientId;
    const name = `values-auction:${sessionId}`;
    this.channel = new BroadcastChannel(name);
    this.channel.onmessage = (ev: MessageEvent<TransportMessage>) => {
      if (ev.data.sender === this.clientId) return;
      for (const h of this.handlers) h(ev.data);
    };
  }

  send(msg: TransportMessage): void {
    this.channel?.postMessage(msg);
  }

  subscribe(handler: (m: TransportMessage) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  subscribeStatus(handler: (status: ConnectionStatus) => void): () => void {
    handler(this.status);
    // no transitions ever happen for an in-process channel
    return () => {};
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  disconnect(): void {
    this.channel?.close();
    this.channel = undefined;
    this.handlers.clear();
  }
}
