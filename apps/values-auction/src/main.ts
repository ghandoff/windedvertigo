import '@/design/reset.css';
import '@/design/tokens.css';
import '@/design/base.css';
import '@/design/motion.css';

import { currentRoute, onRouteChange, navigate } from '@/router';
import { createController, type Controller } from '@/state/controller';
import { exportIdentityCard } from '@/identity-card/render';

import '@/views/participant';
import '@/views/facilitator';
import '@/views/wall';
import '@/views/landing';

const app = document.getElementById('app');
if (!app) throw new Error('missing #app mount point');

let controller: Controller | null = null;

async function render() {
  const route = currentRoute();

  if (route.route === 'landing') {
    controller?.destroy();
    controller = null;
    app!.innerHTML = '';
    app!.appendChild(document.createElement('va-landing'));
    return;
  }

  if (!controller || controller.store.getState().id !== route.code) {
    controller?.destroy();
    const role =
      route.route === 'facilitate'
        ? 'facilitator'
        : route.route === 'wall'
          ? 'wall'
          : 'participant';
    controller = await createController(route.code, role);
  }

  app!.innerHTML = '';
  let view: HTMLElement;
  if (route.route === 'join') {
    const el = document.createElement('va-participant') as HTMLElement & {
      controller: Controller;
      code: string;
    };
    el.controller = controller!;
    el.code = route.code;
    view = el;
  } else if (route.route === 'facilitate') {
    const el = document.createElement('va-facilitator') as HTMLElement & {
      controller: Controller;
      code: string;
    };
    el.controller = controller!;
    el.code = route.code;
    view = el;
  } else {
    const el = document.createElement('va-wall') as HTMLElement & {
      controller: Controller;
      code: string;
    };
    el.controller = controller!;
    el.code = route.code;
    view = el;
  }
  app!.appendChild(view);
}

window.addEventListener('load', () => {
  if (!window.location.hash) navigate('landing');
  render();
});

onRouteChange(() => render());

// global handler: identity card download
document.addEventListener('va-download-card', async (e: Event) => {
  const detail = (e as CustomEvent).detail as { teamId: string };
  if (!controller) return;
  const team = controller.store.getState().teams.find((t) => t.id === detail.teamId);
  if (!team) return;
  await exportIdentityCard(team);
});

// global handler: auction timeout → end it (authoritative client only)
setInterval(() => {
  if (!controller || !controller.isAuthoritative()) return;
  const s = controller.store.getState();
  const a = s.currentAuction;
  if (!a || a.lockedIn) return;
  const elapsed = Date.now() - a.startedAt;
  if (elapsed >= a.durationMs) {
    controller.dispatch({ type: 'AUCTION_END', at: Date.now() });
  }
}, 500);

// eslint-disable-next-line no-console
console.log('[values-auction] open:');
// eslint-disable-next-line no-console
console.log('  facilitator → #/facilitate?code=DEMO');
// eslint-disable-next-line no-console
console.log('  participant → #/join?code=DEMO');
// eslint-disable-next-line no-console
console.log('  wall        → #/wall?code=DEMO');
