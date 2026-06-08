/**
 * KV-backed storage for OAuth bookkeeping: registered clients (DCR) + one-time
 * authorization codes. Access tokens are stateless JWTs, so they are NOT stored.
 * Binding: OAUTH_KV (namespace wv-port-oauth).
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

interface KVLike {
  get(key: string, type: "json"): Promise<unknown>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

function kv(): KVLike {
  const { env } = getCloudflareContext();
  const ns = (env as unknown as { OAUTH_KV?: KVLike }).OAUTH_KV;
  if (!ns) throw new Error("OAUTH_KV binding missing");
  return ns;
}

export interface OAuthClient {
  client_id: string;
  redirect_uris: string[];
  client_name?: string;
  created_at: number;
}

export interface AuthCode {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  email: string;
  resource: string;
  scope: string;
}

export async function putClient(c: OAuthClient): Promise<void> {
  // Persist registered clients (no TTL). DCR clients are cheap; Claude re-registers
  // if it ever can't find its client_id.
  await kv().put(`client:${c.client_id}`, JSON.stringify(c));
}

export async function getClient(client_id: string): Promise<OAuthClient | null> {
  if (!client_id) return null;
  return (await kv().get(`client:${client_id}`, "json")) as OAuthClient | null;
}

export async function putCode(code: string, data: AuthCode): Promise<void> {
  // Short-lived, one-time. 120s covers the browser round-trip comfortably.
  await kv().put(`code:${code}`, JSON.stringify(data), { expirationTtl: 120 });
}

/** Fetch + delete (one-time use). Returns null if missing/expired. */
export async function takeCode(code: string): Promise<AuthCode | null> {
  if (!code) return null;
  const key = `code:${code}`;
  const v = (await kv().get(key, "json")) as AuthCode | null;
  if (v) await kv().delete(key);
  return v;
}
