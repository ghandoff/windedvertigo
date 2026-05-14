import '@/design/reset.css';
import '@/design/tokens.css';
import '@/design/base.css';
import '@/design/motion.css';

import { currentRoute, onRouteChange } from '@/router';
import { createController, type Controller } from '@/state/controller';
import { exportIdentityCard } from '@/identity-card/render';
import { initPrefs } from '@/state/prefs';

import '@/views/participant';
import '@/views/facilitator';
import '@/views/wall';
import '@/views/landing';
import '@/components/settings-drawer';
import '@/components/connection-banner';
import type { VaConnectionBanner } from '@/components/connection-banner';

initPrefs();

const app = document.getElementById('app');
if (!app) throw new Error('missing #app mount point');

// always-on accessibility controls, mounted once at the document level
if (!document.querySelector('va-settings-drawer')) {
  document.body.appendChild(document.createElement('va-settings-drawer'));
}

// always-on connection status banner, mounted once at the document level.
// rebound to the active controller's transport on every route change.
let connectionBanner: VaConnectionBanner | null = null;
if (!document.querySelector('va-connection-banner')) {
  connectionBanner = document.createElement('va-connection-banner') as VaConnectionBanner;
  document.body.appendChild(connectionBanner);
} else {
  connectionBanner = document.querySelector('va-connection-banner') as VaConnectionBanner;
}

let controller: Controller | null = null;

async function render() {
  const route = currentRoute();

  if (route.route === 'landing') {
    controller?.destroy();
    controller = null;
    connectionBanner?.attach(undefined);
    app!.innerHTML = '';
    app!.appendChild(document.createElement('va-landing'));
    return;
  }

  if (!controller || controller.store.getState().id !== route.code) {
    controller?.destroy();
    connectionBanner?.attach(undefined);
    const role =
      route.route === 'facilitate'
        ? 'facilitator'
        : route.route === 'wall'
          ? 'wall'
          : 'participant';
    controller = await createController(route.code, role);
    connectionBanner?.attach(controller.transport);
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
  render();
});

onRouteChange(() => render());

// global handler: identity card download
document.addEventListener('va-download-card', async (e: Event) => {
  const detail = (e as CustomEvent).detail as { teamId: string };
  if (!controller) return;
  const team = controller.store.getState().teams.find((t) => t.id === detail.teamId);
  if (!team) return;
  try {
    await exportIdentityCard(team);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[va-download-card]', err);
    alert('Download failed — try a different browser or take a screenshot instead.');
  }
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

/**
 * captain disconnect watcher (authoritative only).
 *
 * a captain is considered offline if their lastSeenAt is older than the
 * grace period. when that happens we auto-transfer the role to the next
 * participant in the team roster (first joined that isn't the captain).
 */
// must be greater than the participant heartbeat interval (240_000ms in
// participant.ts) so a captain who's idle but online doesn't get
// auto-transferred between beats. 6 minutes = up to 2 missed beats.
const CAPTAIN_GRACE_MS = 360_000;
setInterval(() => {
  if (!controller || !controller.isAuthoritative()) return;
  const s = controller.store.getState();
  const now = Date.now();
  for (const team of s.teams) {
    if (!team.captainParticipantId) continue;
    const captain = s.participants.find((p) => p.id === team.captainParticipantId);
    if (!captain) continue;
    if (now - captain.lastSeenAt < CAPTAIN_GRACE_MS) continue;
    const replacement = s.participants
      .filter((p) => p.teamId === team.id && p.id !== captain.id)
      .sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (!replacement) continue;
    controller.dispatch({
      type: 'CAPTAIN_AUTO_TRANSFER',
      teamId: team.id,
      newCaptainId: replacement.id,
      reason: 'disconnect',
      at: now,
    });
  }
}, 5_000);

// eslint-disable-next-line no-console
console.log('[values-auction] open:');
// eslint-disable-next-line no-console
console.log('  facilitator → #/facilitate?code=DEMO');
// eslint-disable-next-line no-console
console.log('  participant → #/join?code=DEMO');
// eslint-disable-next-line no-console
console.log('  wall        → #/wall?code=DEMO');
