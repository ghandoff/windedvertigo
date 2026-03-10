import { createClient } from '@vercel/kv';

let kv = null;

function get_kv() {
  if (kv) return kv;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN
  });
  return kv;
}

/**
 * Get a per-user OAuth token from Vercel KV.
 * Returns null if KV is not configured or token doesn't exist.
 *
 * @param {string} member_name — e.g. 'garrett'
 * @param {string} provider — 'notion' or 'slack'
 * @returns {Promise<string|null>}
 */
export async function get_token(member_name, provider) {
  const store = get_kv();
  if (!store) return null;

  try {
    const token = await store.get(`token:${member_name}:${provider}`);
    return token || null;
  } catch (err) {
    console.error(`[kv] get_token failed for ${member_name}:${provider}: ${err.message}`);
    return null;
  }
}

/**
 * Store a per-user OAuth token in Vercel KV.
 *
 * @param {string} member_name
 * @param {string} provider — 'notion' or 'slack'
 * @param {string} token
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function set_token(member_name, provider, token) {
  const store = get_kv();
  if (!store) return { success: false, error: 'KV not configured' };

  try {
    await store.set(`token:${member_name}:${provider}`, token);
    console.log(`[kv] stored token for ${member_name}:${provider}`);
    return { success: true };
  } catch (err) {
    console.error(`[kv] set_token failed for ${member_name}:${provider}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Check which providers a member has connected.
 *
 * @param {string} member_name
 * @returns {Promise<{notion: boolean, slack: boolean}>}
 */
export async function get_connection_status(member_name) {
  const store = get_kv();
  if (!store) return { notion: false, slack: false };

  try {
    const [notion, slack] = await Promise.all([
      store.get(`token:${member_name}:notion`),
      store.get(`token:${member_name}:slack`)
    ]);
    return { notion: !!notion, slack: !!slack };
  } catch (err) {
    console.error(`[kv] get_connection_status failed for ${member_name}: ${err.message}`);
    return { notion: false, slack: false };
  }
}
