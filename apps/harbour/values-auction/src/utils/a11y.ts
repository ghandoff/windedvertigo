let politeRegion: HTMLElement | null = null;
let assertiveRegion: HTMLElement | null = null;

function ensureRegion(kind: 'polite' | 'assertive'): HTMLElement {
  const existing = kind === 'polite' ? politeRegion : assertiveRegion;
  if (existing && document.body.contains(existing)) return existing;
  const region = document.createElement('div');
  region.setAttribute('aria-live', kind);
  region.setAttribute('aria-atomic', 'true');
  region.className = 'sr-only';
  document.body.appendChild(region);
  if (kind === 'polite') politeRegion = region;
  else assertiveRegion = region;
  return region;
}

export function announce(message: string, kind: 'polite' | 'assertive' = 'polite') {
  if (typeof document === 'undefined') return;
  const region = ensureRegion(kind);
  region.textContent = '';
  // force re-announce by briefly clearing, then setting
  window.setTimeout(() => {
    region.textContent = message;
  }, 10);
}

export function trapFocus(root: HTMLElement): () => void {
  const focusable = root.querySelectorAll<HTMLElement>(
    'a[href],button:not([disabled]),textarea,input:not([disabled]),select,[tabindex]:not([tabindex="-1"])',
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  first?.focus();
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    if (focusable.length === 0) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
  root.addEventListener('keydown', onKey);
  return () => root.removeEventListener('keydown', onKey);
}
