import { BroadcastTransport } from '@/transport/broadcast';
import { SocketTransport } from '@/transport/socket';
import type { Transport } from '@/transport/transport';
import { uid } from '@/utils/id';

export function createTransport(clientId = uid('c')): Transport {
  const env = (import.meta.env as Record<string, string | undefined>) ?? {};
  // production defaults to socket so participants on different devices can sync.
  // broadcastchannel only works same-browser, which left phone joiners stuck.
  const defaultMode = env.PROD ? 'socket' : 'broadcast';
  const mode = env.VITE_TRANSPORT ?? defaultMode;
  if (mode === 'socket') {
    const url =
      env.VITE_WS_URL ?? 'wss://wv-values-auction-relay.windedvertigo.workers.dev/ws';
    return new SocketTransport(clientId, url);
  }
  return new BroadcastTransport(clientId);
}

export * from '@/transport/transport';
