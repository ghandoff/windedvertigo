import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createStore } from '@/state/store';
import { reduce, assignTeams } from '@/state/reducers';
import type { Controller } from '@/state/controller';
import type { Action } from '@/state/types';

/**
 * jsdom render smoke test. covers the same ground the playwright e2e was
 * intended to cover (every view mounts and renders without throwing) so we
 * can verify locally in environments where the playwright chromium binary
 * isn't available. the e2e suite is still useful in CI for full-flow checks.
 */

beforeAll(async () => {
  // import the view modules so their custom elements register.
  await import('@/views/landing');
  await import('@/views/participant');
  await import('@/views/facilitator');
  await import('@/views/wall');
});

/**
 * lit `update()` resolves once the first render completes.
 * we await it before asserting the shadow root has content.
 */
async function waitForRender(el: HTMLElement) {
  const lit = el as unknown as { updateComplete?: Promise<unknown> };
  if (lit.updateComplete) await lit.updateComplete;
}

function makeFakeController(sessionCode = 'TEST'): Controller {
  const store = createStore(sessionCode, 'fac');
  const listeners: Array<(msg: unknown) => void> = [];
  const noop = () => undefined;
  return {
    store,
    transport: {
      connect: async () => {},
      send: noop,
      subscribe: (fn: (msg: unknown) => void) => {
        listeners.push(fn);
        return () => {};
      },
      disconnect: noop,
    } as unknown as Controller['transport'],
    role: 'facilitator',
    clientId: 'test',
    dispatch: (action: Action) => store.dispatch(action),
    isAuthoritative: () => true,
    destroy: noop,
  };
}

describe('views render smoke', () => {
  let mount: HTMLDivElement;

  beforeEach(() => {
    mount = document.createElement('div');
    document.body.appendChild(mount);
  });

  it('landing renders without throwing and shows the hero copy', async () => {
    const el = document.createElement('va-landing');
    mount.appendChild(el);
    await waitForRender(el);
    expect(el.shadowRoot?.textContent ?? '').toMatch(/values auction/i);
  });

  it('facilitator dashboard renders the act timeline panel', async () => {
    const controller = makeFakeController('F1');
    const el = document.createElement('va-facilitator') as HTMLElement & {
      controller: Controller;
      code: string;
    };
    el.controller = controller;
    el.code = 'F1';
    mount.appendChild(el);
    await waitForRender(el);
    expect(el.shadowRoot?.textContent ?? '').toMatch(/act timeline/i);
  });

  it('participant view shows the welcome arrival pane on first load', async () => {
    const controller = makeFakeController('P1');
    const el = document.createElement('va-participant') as HTMLElement & {
      controller: Controller;
      code: string;
    };
    el.controller = controller;
    el.code = 'P1';
    mount.appendChild(el);
    await waitForRender(el);
    const text = el.shadowRoot?.textContent ?? '';
    expect(text).toMatch(/values auction/i);
    // arrival welcome cta is unconditional on a fresh tab.
    expect(text).toMatch(/enter the room/i);
  });

  it('participant view honours preview mode (no join form, no late-joiner stranding)', async () => {
    const controller = makeFakeController('P2');
    // seed a real team + participant so preview has someone to mirror.
    const { teams, assignments } = assignTeams(
      [{ id: 'p_seed', archetype: 'builder' }],
      4,
    );
    controller.dispatch({
      type: 'PARTICIPANT_JOIN',
      participant: {
        id: 'p_seed',
        displayName: 'Alex',
        teamId: null,
        joinedAt: 0,
        lastSeenAt: 0,
        role: 'participant',
      },
    });
    controller.dispatch({ type: 'TEAMS_FORM', teams, assignments });
    controller.dispatch({ type: 'ACT_ADVANCE', to: 'scene', at: 1 });
    const el = document.createElement('va-participant') as HTMLElement & {
      controller: Controller;
      code: string;
      preview: boolean;
    };
    el.controller = controller;
    el.code = 'P2';
    el.preview = true;
    mount.appendChild(el);
    await waitForRender(el);
    const text = el.shadowRoot?.textContent ?? '';
    // preview should not render the name-entry join form.
    expect(text).not.toMatch(/enter the room/i);
    // it should be showing the seeded participant's experience in the scene act.
    expect(text.toLowerCase()).toContain('twenty values');
  });

  it('wall renders an idle screen showing the session code', async () => {
    const controller = makeFakeController('W1');
    const el = document.createElement('va-wall') as HTMLElement & {
      controller: Controller;
      code: string;
    };
    el.controller = controller;
    el.code = 'W1';
    mount.appendChild(el);
    await waitForRender(el);
    expect(el.shadowRoot?.textContent ?? '').toMatch(/W1/);
  });

  it('reduce + dispatch propagates state through the store', () => {
    const store = createStore('S', 'fac');
    const initial = store.getState();
    expect(initial.currentAct).toBe('arrival');
    const next = reduce(initial, {
      type: 'ACT_ADVANCE',
      to: 'brainstorm',
      at: 1,
    });
    expect(next.currentAct).toBe('brainstorm');
  });
});
