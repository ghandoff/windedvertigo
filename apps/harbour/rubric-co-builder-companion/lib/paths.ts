// single source of truth for the companion's base path.
export const BASE_PATH = "/harbour/rubric-co-builder-companion";

export function path(p: string): string {
  const n = p.startsWith("/") ? p : `/${p}`;
  return `${BASE_PATH}${n}`;
}
