export type TransportRole = 'facilitator' | 'participant' | 'wall';

/**
 * connection status surfaced to UI. socket transports cycle through these
 * as the WebSocket opens, drops, and reconnects. in-process transports
 * (broadcast channel) report 'connected' permanently.
 */
export type ConnectionStatus = 'connected' | 'reconnecting' | 'offline';

export interface TransportMessage {
  /**
   * Message type vocabulary spoken by clients + the hub Worker DO:
   *   - 'action'        client → all peers: a reducer action to be applied locally on each
   *   - 'state'         hub or facilitator → one peer: a full Session snapshot, applied verbatim
   *   - 'hello'         reserved for future presence (unused today)
   *   - 'request-state' client → hub (or peers if hub has no snapshot): "send me current state"
   *   - 'snapshot'      facilitator → hub ONLY: upload latest Session for storage; never relayed
   */
  type: 'action' | 'state' | 'hello' | 'request-state' | 'snapshot';
  payload: unknown;
  at: number;
  sender: string;
}

export interface Transport {
  connect(sessionId: string, role: TransportRole, clientId: string): Promise<void>;
  send(msg: TransportMessage): void;
  subscribe(handler: (msg: TransportMessage) => void): () => void;
  disconnect(): void;
  /**
   * Subscribe to connection-status changes. Called immediately with the
   * current status, then on every transition. Returns an unsubscribe fn.
   */
  subscribeStatus(handler: (status: ConnectionStatus) => void): () => void;
  getStatus(): ConnectionStatus;
  readonly clientId: string;
}
