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
    // hub is the values-auction-hub Worker (workers/hub/) — it holds the
    // session DO with snapshot persistence so request-state survives a
    // facilitator crash. the older wv-values-auction-relay Worker is
    // retired as of 2026-05-14 (Phase B-min); leave VITE_WS_URL set in
    // dev/staging to override.
    const url =
      env.VITE_WS_URL ?? 'wss://values-auction-hub.windedvertigo.workers.dev/ws';
    return new SocketTransport(clientId, url);
  }
  return new BroadcastTransport(clientId);
}

export * from '@/transport/transport';
