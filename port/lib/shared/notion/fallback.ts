/**
 * @windedvertigo/notion — fallback helpers
 *
 * Read cached JSON files as a resilience layer when Notion is unreachable.
 */

import fs from "fs";
import path from "path";

/**
 * Read a fallback JSON file from a data/ directory.
 * Returns null if the file is missing.
 */
export function readFallback<T>(filename: string, cwd?: string): T | null {
  try {
    const filePath = path.join(cwd ?? process.cwd(), "data", filename);
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Try a live Notion fetch. If it fails, fall back to a cached JSON file.
 * Makes builds resilient when Notion is down or the token is missing.
 */
export async function withFallback<T>(
  fetcher: () => Promise<T>,
  fallbackFile: string,
  label: string,
  cwd?: string,
): Promise<T> {
  try {
    return await fetcher();
  } catch (err) {
    console.warn(
      `[notion] ${label} failed, falling back to ${fallbackFile}: ${(err as Error).message}`,
    );
    const data = readFallback<T>(fallbackFile, cwd);
    if (data !== null) return data;
    throw err; // no fallback available — propagate error
  }
}
