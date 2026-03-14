import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Fires callback when the app transitions between background/active states.
 * Useful for refreshing data when the user returns to the app.
 */
export function useAppState(on_change: (state: AppStateStatus) => void) {
  const callback_ref = useRef(on_change);
  callback_ref.current = on_change;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      callback_ref.current(state);
    });
    return () => sub.remove();
  }, []);
}
