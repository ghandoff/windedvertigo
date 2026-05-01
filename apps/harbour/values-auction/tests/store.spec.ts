import { describe, it, expect, vi } from 'vitest';
import { createStore } from '@/state/store';
import { actTimeRemainingMs } from '@/state/selectors';

describe('store', () => {
  it('notifies subscribers on dispatch', () => {
    const store = createStore('T', 'fac');
    const spy = vi.fn();
    const unsub = store.subscribe(spy);
    store.dispatch({ type: 'SESSION_START' });
    expect(spy).toHaveBeenCalledTimes(1);
    unsub();
    store.dispatch({ type: 'ACT_EXTEND', addMs: 1000 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('replace() overrides state', () => {
    const store = createStore('T', 'fac');
    const original = store.getState();
    store.replace({ ...original, currentAct: 'auction' });
    expect(store.getState().currentAct).toBe('auction');
  });

  it('actTimeRemainingMs clamps at zero', () => {
    const store = createStore('T', 'fac');
    const s = store.getState();
    const remaining = actTimeRemainingMs(
      { ...s, actStartedAt: 0, actDurationMs: 1000 },
      5_000,
    );
    expect(remaining).toBe(0);
  });
});
