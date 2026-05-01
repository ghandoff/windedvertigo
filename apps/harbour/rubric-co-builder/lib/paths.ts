// single source of truth for the app's base path.
// in local dev this is empty (preview panel hits `/`); in production it's
// `/harbour/rubric-co-builder` via NEXT_PUBLIC_BASE_PATH set on Vercel.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function apiPath(path: string): string {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${normalised}`;
}
