/**
 * Shared version-label utilities.
 *
 * bumpVersion is extracted from the inline helper in
 * src/app/api/pcs/documents/[id]/view/edit/route.js so the propagation
 * engine can reuse it without pulling in the edit route's full dependency tree.
 */

/**
 * Increment the minor segment of a v<major>.<minor> version label.
 * Returns v<major>.<minor+1> for well-formed inputs.
 * Falls back to appending a date stamp for non-standard formats.
 *
 * Examples:
 *   bumpVersion('v1.2')   -> 'v1.3'
 *   bumpVersion('v2.0')   -> 'v2.1'
 *   bumpVersion(null)     -> 'v1.1'
 *   bumpVersion('custom') -> 'custom+e20260613'
 */
export function bumpVersion(current) {
  if (!current) return 'v1.1';
  const trimmed = current.trim();
  const parts = trimmed.replace(/^v/, '').match(/^(\d+)\.(\d+)$/);
  if (parts) {
    const major = Number(parts[1]);
    const minor = Number(parts[2]) + 1;
    return `v${major}.${minor}`;
  }
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${trimmed}+e${stamp}`;
}
