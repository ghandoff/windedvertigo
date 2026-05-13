import type { ActSurface } from '@/content/acts';

export function applyActSurface(surface: ActSurface): void {
  if (typeof document === 'undefined') return;
  if (document.documentElement.dataset.surface === surface) return;
  document.documentElement.dataset.surface = surface;
}

export function clearActSurface(): void {
  if (typeof document === 'undefined') return;
  delete document.documentElement.dataset.surface;
}
