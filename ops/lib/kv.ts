// Cloudflare KV REST API utilities.
// Reads and writes JSON values to the wv-ops-data namespace.

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
