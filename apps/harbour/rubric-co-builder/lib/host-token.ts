// Single source of truth for the per-room facilitator token.
// The token is returned once by POST /api/rooms and must be sent as
// X-Host-Token on every facilitator mutation. We persist in sessionStorage
// so it survives a refresh but disappears when the tab closes — which is
// the desired "facilitator session" lifetime for a single workshop.

const key = (code: string) => `rcb:host_token:${code}`;

export function saveHostToken(code: string, token: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key(code), token);
  } catch {
    // sessionStorage can throw in private-browsing/quota-exceeded edge cases.
    // The host UI will surface a "lost session" state if the token is missing.
  }
}

export function loadHostToken(code: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(key(code));
  } catch {
    return null;
  }
}

export function clearHostToken(code: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key(code));
  } catch {
    // best-effort
  }
}

export function hostHeaders(code: string): Record<string, string> {
  const t = loadHostToken(code);
  return t ? { "X-Host-Token": t } : {};
}

/**
 * Fetch wrapper that auto-attaches X-Host-Token for the given room code.
 * Falls back to the bare fetch behaviour if no token is found — the API
 * will then 403 and the caller can detect a lost session.
 */
export async function hostFetch(
  code: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = loadHostToken(code);
  if (token) headers.set("X-Host-Token", token);
  return fetch(path, { ...init, headers });
}
