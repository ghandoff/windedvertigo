export type TransportRole = 'facilitator' | 'participant' | 'wall';

export interface TransportMessage {
  type: 'action' | 'state' | 'hello' | 'request-state';
  payload: unknown;
  at: number;
  sender: string;
}

export interface Transport {
  connect(sessionId: string, role: TransportRole, clientId: string): Promise<void>;
  send(msg: TransportMessage): void;
  subscribe(handler: (msg: TransportMessage) => void): () => void;
  disconnect(): void;
  readonly clientId: string;
}
