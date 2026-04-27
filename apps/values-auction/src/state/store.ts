import type { Action, Session } from '@/state/types';
import { initialSession, reduce } from '@/state/reducers';

export type Listener = (session: Session) => void;

export interface Store {
  getState(): Session;
  dispatch(action: Action): Session;
  replace(session: Session): void;
  subscribe(listener: Listener): () => void;
}

export function createStore(sessionId: string, facilitatorId: string): Store {
  let state: Session = initialSession(sessionId, facilitatorId);
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    dispatch(action) {
      state = reduce(state, action);
      for (const l of listeners) l(state);
      return state;
    },
    replace(next) {
      state = next;
      for (const l of listeners) l(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
