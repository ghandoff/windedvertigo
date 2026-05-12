/**
 * KV access layer.
 *
 * On CF Workers (CF_WORKERS_ENV=1): uses native OPS_DATA binding via
 * getCloudflareContext() — no HTTP overhead, no token required.
 *
 * Local dev fallback: Cloudflare KV REST API using CLOUDFLARE_ACCOUNT_ID +
 * CLOUDFLARE_API_TOKEN env vars (same behaviour as before H.1 migration).
 */

import type { KVNamespace } from '@cloudflare/workers-types';

// Lazy import to avoid evaluation in environments where @opennextjs/cloudflare
// is not bundled (e.g. local Next.js dev server without wrangler).
async function getOpsDataKv(): Promise<KVNamespace | null> {
  if (process.env.CF_WORKERS_ENV !== '1') return null;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = getCloudflareContext();
    return ((env as unknown) as { OPS_DATA?: KVNamespace }).OPS_DATA ?? null;
  } catch {
    return null;
  }
}

// REST API fallback (local dev / pre-migration)
const KV_NAMESPACE_ID = '6793fcb92d2d485ba4bbe5c6e74a9d29';

function kvUrl(key: string): string | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) return null;
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${encodeURIComponent(key)}`;
}

function authHeaders(): Record<string, string> | null {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Read a key from Cloudflare KV. Returns parsed JSON or null on any failure.
 */
export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  // Native binding path (CF Workers)
  const kv = await getOpsDataKv();
  if (kv) {
    try {
      return await kv.get<T>(key, 'json');
    } catch {
      return null;
    }
  }

  // REST API fallback (local dev)
  try {
    const url = kvUrl(key);
    const headers = authHeaders();
    if (!url || !headers) return null;

    const res = await fetch(url, { headers, next: { revalidate: 0 } });
    if (!res.ok) return null;

    const data = (await res.json()) as T;
    return data;
  } catch {
    return null;
  }
}

/**
 * Write a JSON value to Cloudflare KV. Returns true on success, false on any failure.
 */
export async function kvPut(key: string, value: unknown): Promise<boolean> {
  // Native binding path (CF Workers)
  const kv = await getOpsDataKv();
  if (kv) {
    try {
      await kv.put(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  // REST API fallback (local dev)
  try {
    const url = kvUrl(key);
    const headers = authHeaders();
    if (!url || !headers) return false;

    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(value),
    });

    return res.ok;
  } catch {
    return false;
  }
}
