export interface Env {
  SESSION_KV: KVNamespace;
}

export function apiHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
}

// list all KV keys with a given prefix (handles pagination)
export async function listKeys(kv: KVNamespace, prefix: string): Promise<string[]> {
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const result = await kv.list({ prefix, cursor });
    names.push(...result.keys.map((k) => k.name));
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  return names;
}
