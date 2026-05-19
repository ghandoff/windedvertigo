// single source of truth for the app's base path.
// URL slug = co-rubric; brand display = co.rubric (with the dot).
export const BASE_PATH = "/harbour/co-rubric";

export function apiPath(path: string): string {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${normalised}`;
}
