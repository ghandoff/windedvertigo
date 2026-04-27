export type Route = 'join' | 'facilitate' | 'wall' | 'landing';

export interface RouteState {
  route: Route;
  code: string;
  presenter: boolean;
}

function parseHash(): { path: string; params: URLSearchParams } {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  return { path: path ?? '', params: new URLSearchParams(query) };
}

export function currentRoute(): RouteState {
  const { path, params } = parseHash();
  const code = params.get('code') ?? 'DEMO';
  const presenter = params.get('presenter') === '1';
  if (path === 'join') return { route: 'join', code, presenter };
  if (path === 'facilitate') return { route: 'facilitate', code, presenter };
  if (path === 'wall') return { route: 'wall', code, presenter };
  return { route: 'landing', code, presenter };
}

export function onRouteChange(handler: (r: RouteState) => void): () => void {
  const listener = () => handler(currentRoute());
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

export function navigate(route: Route, code = 'DEMO') {
  window.location.hash = `/${route}?code=${encodeURIComponent(code)}`;
}
