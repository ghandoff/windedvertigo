// single source of truth for the companion's base path.
// URL slug = co-rubric-companion; brand display = "co.rubric companion".
export const BASE_PATH = "/harbour/co-rubric-companion";

export function path(p: string): string {
  const n = p.startsWith("/") ? p : `/${p}`;
  return `${BASE_PATH}${n}`;
}
