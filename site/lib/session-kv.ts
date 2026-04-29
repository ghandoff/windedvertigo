import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { KVNamespace, KVNamespaceListResult } from "@cloudflare/workers-types";

export function apiHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

export function getSessionKv(): KVNamespace {
  const { env } = getCloudflareContext();
  const kv = (env as unknown as { SESSION_KV?: KVNamespace }).SESSION_KV;
  if (!kv) {
    throw new Error("SESSION_KV binding not found — check site/wrangler.jsonc");
  }
  return kv;
}

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin + "st-salt-2026");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function listKeys(kv: KVNamespace, prefix: string): Promise<string[]> {
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const result: KVNamespaceListResult<unknown, string> = await kv.list({ prefix, cursor });
    names.push(...result.keys.map((k) => k.name));
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  return names;
}

export const SESSION_TTL = 86400;
