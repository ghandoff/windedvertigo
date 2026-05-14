import { createStore, type Store } from '@/state/store';
import { reduce } from '@/state/reducers';
import type { Action, Session } from '@/state/types';
import { createTransport, type Transport, type TransportRole } from '@/transport';
import { uid } from '@/utils/id';

export interface Controller {
  store: Store;
  transport: Transport;
  role: TransportRole;
  clientId: string;
  dispatch(action: Action): void;
  isAuthoritative(): boolean;
  destroy(): void;
}

function storageKey(sessionId: string) {
  return `va:session:${sessionId}`;
}

function hydrate(sessionId: string): Session | null {
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function persist(session: Session) {
  try {
    localStorage.setItem(storageKey(session.id), JSON.stringify(session));
  } catch {
    // ignore quota errors
  }
}

export async function createController(
  sessionId: string,
  role: TransportRole,
  facilitatorId = 'facilitator-local',
): Promise<Controller> {
  const clientId = uid(role.slice(0, 3));
  const store = createStore(sessionId, facilitatorId);

  const cached = hydrate(sessionId);
  if (cached) store.replace(cached);

  const transport = createTransport(clientId);
  await transport.connect(sessionId, role, clientId);

  const authoritative = role === 'facilitator';

  // persist to localStorage is on the hot path — at scale every state
  // replace was triggering a full JSON.stringify + setItem. debounce so
  // we write at most once every PERSIST_DEBOUNCE_MS, plus a flush on
  // destroy so the latest state survives navigation.
  const PERSIST_DEBOUNCE_MS = 2_000;
  let pendingSession: Session | null = null;
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  function flushPersist() {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    if (pendingSession) {
      persist(pendingSession);
      pendingSession = null;
    }
  }
  const unsub = store.subscribe((s) => {
    pendingSession = s;
    if (persistTimer) return;
    persistTimer = setTimeout(() => {
      persistTimer = null;
      if (pendingSession) {
        persist(pendingSession);
        pendingSession = null;
      }
    }, PERSIST_DEBOUNCE_MS);
  });

  transport.subscribe((msg) => {
    if (msg.type === 'state') {
      // canonical snapshot from the facilitator: a hard reset of local
      // state. used on join, reconnect-resync, and periodic drift sync.
      store.replace(msg.payload as Session);
      return;
    }
    if (msg.type === 'action') {
      // every client (authoritative or not) reduces broadcast actions
      // locally. the single-DO relay serialises message order so all
      // peers apply the same sequence and converge deterministically.
      // before this change, the facilitator re-broadcast the full
      // ~100-500KB Session JSON on every action; at 250 peers that
      // payload × fan-out is what collapsed the May 14 session.
      const next = reduce(store.getState(), msg.payload as Action);
      store.replace(next);
      return;
    }
    if (msg.type === 'request-state' && authoritative) {
      transport.send({
        type: 'state',
        payload: store.getState(),
        at: Date.now(),
        sender: clientId,
      });
    }
  });

  if (!authoritative) {
    transport.send({
      type: 'request-state',
      payload: null,
      at: Date.now(),
      sender: clientId,
    });
  }

  function dispatch(action: Action) {
    // optimistic local reduce so the sender's UI responds immediately.
    // the relay echoes our message back to all other peers; SocketTransport
    // filters our own clientId, so we don't double-apply. all peers reduce
    // the same action in the same DO-serialised order → convergent state.
    store.dispatch(action);
    transport.send({
      type: 'action',
      payload: action,
      at: Date.now(),
      sender: clientId,
    });
  }

  // periodic drift-correction snapshot from the authoritative facilitator.
  // strictly speaking the action-broadcast model converges without this —
  // DO ordering guarantees it. but a low-rate full-state sync is cheap
  // insurance against missed messages (mid-reconnect, browser tab
  // throttled, etc.) and bounds worst-case staleness to DRIFT_SYNC_MS.
  const DRIFT_SYNC_MS = 30_000;
  let driftSyncTimer: ReturnType<typeof setInterval> | null = null;
  if (authoritative) {
    driftSyncTimer = setInterval(() => {
      transport.send({
        type: 'state',
        payload: store.getState(),
        at: Date.now(),
        sender: clientId,
      });
    }, DRIFT_SYNC_MS);
  }

  return {
    store,
    transport,
    role,
    clientId,
    dispatch,
    isAuthoritative: () => authoritative,
    destroy() {
      if (driftSyncTimer) {
        clearInterval(driftSyncTimer);
        driftSyncTimer = null;
      }
      flushPersist();
      unsub();
      transport.disconnect();
    },
  };
}
