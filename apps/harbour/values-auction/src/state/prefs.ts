/**
 * accessibility preferences — theme, motion, text-size — persisted to
 * localStorage and applied as data-attributes on <html>. base.css reads
 * those attributes to override tokens.
 *
 * defaults respect the OS where we can: prefers-reduced-motion maps to
 * 'subtle', prefers-contrast: more to 'high-contrast'. the in-app
 * controls always win once the user picks something.
 */

export type Theme = 'default' | 'dark' | 'high-contrast';
export type Motion = 'full' | 'subtle' | 'none';
export type TextSize = 'md' | 'lg' | 'xl';

export interface Prefs {
  theme: Theme;
  motion: Motion;
  textSize: TextSize;
}

const STORAGE_KEY = 'va:prefs';

const listeners = new Set<(p: Prefs) => void>();

function osDefaults(): Prefs {
  const reduced =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  const moreContrast =
    typeof matchMedia === 'function' && matchMedia('(prefers-contrast: more)').matches;
  return {
    theme: moreContrast ? 'high-contrast' : 'default',
    motion: reduced ? 'subtle' : 'full',
    textSize: 'md',
  };
}

export function loadPrefs(): Prefs {
  const defaults = osDefaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      theme: parsed.theme ?? defaults.theme,
      motion: parsed.motion ?? defaults.motion,
      textSize: parsed.textSize ?? defaults.textSize,
    };
  } catch {
    return defaults;
  }
}

export function applyPrefs(p: Prefs) {
  const html = document.documentElement;
  html.dataset.theme = p.theme;
  html.dataset.motion = p.motion;
  html.dataset.textSize = p.textSize;
}

export function savePrefs(next: Partial<Prefs>): Prefs {
  const current = loadPrefs();
  const merged = { ...current, ...next };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // localStorage unavailable — preferences won't persist this session.
  }
  applyPrefs(merged);
  for (const fn of listeners) fn(merged);
  return merged;
}

export function subscribePrefs(fn: (p: Prefs) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initPrefs() {
  applyPrefs(loadPrefs());
}
