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
      store.replace(msg.payload as Session);
      return;
    }
    if (msg.type === 'action') {
      if (authoritative) {
        const next = reduce(store.getState(), msg.payload as Action);
        store.replace(next);
        transport.send({
          type: 'state',
          payload: next,
          at: Date.now(),
          sender: clientId,
        });
      } else {
        const next = reduce(store.getState(), msg.payload as Action);
        store.replace(next);
      }
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
    if (authoritative) {
      const next = store.dispatch(action);
      transport.send({
        type: 'state',
        payload: next,
        at: Date.now(),
        sender: clientId,
      });
    } else {
      transport.send({
        type: 'action',
        payload: action,
        at: Date.now(),
        sender: clientId,
      });
    }
  }

  return {
    store,
    transport,
    role,
    clientId,
    dispatch,
    isAuthoritative: () => authoritative,
    destroy() {
      flushPersist();
      unsub();
      transport.disconnect();
    },
  };
}
