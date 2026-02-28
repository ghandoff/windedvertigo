const BASE_PATH = "/reservoir/creaseworks";

export function apiUrl(path: string): string {
  if (path.startsWith(BASE_PATH)) return path;
  return `${BASE_PATH}${path}`;
}
