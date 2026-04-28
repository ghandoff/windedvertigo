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

function cleanStaleSessionData(currentSessionId: string) {
  const prefix = 'va:session:';
  const stale: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(prefix) && k !== `${prefix}${currentSessionId}`) stale.push(k);
  }
  stale.forEach((k) => localStorage.removeItem(k));
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
  cleanStaleSessionData(sessionId);

  const transport = createTransport(clientId);
  await transport.connect(sessionId, role, clientId);

  const authoritative = role === 'facilitator';

  const unsub = store.subscribe((s) => persist(s));

  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  transport.subscribe((msg) => {
    if (msg.type === 'state') {
      clearTimeout(retryTimer);
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
    const sendReq = () =>
      transport.send({ type: 'request-state', payload: null, at: Date.now(), sender: clientId });
    sendReq();
    retryTimer = setTimeout(() => sendReq(), 3_000);
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
      unsub();
      transport.disconnect();
    },
  };
}
