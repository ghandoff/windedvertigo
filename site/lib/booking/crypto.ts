/**
 * AES-GCM encryption helpers via Web Crypto.
 *
 * Used for storing Google OAuth refresh tokens at rest in Supabase.
 * The encryption key (BOOKING_TOKEN_KEY) is a 32-byte base64-encoded value
 * stored as a Cloudflare Worker secret — never persisted to disk or DB.
 *
 * Output format: base64(ciphertext) + base64(iv), stored in two separate
 * columns (refresh_token_ct, refresh_token_iv) for clarity.
 *
 * Web Crypto only — no node:crypto. Runs identically on CF Workers,
 * Node 18+, and modern browsers.
 */

const KEY_USAGES: KeyUsage[] = ["encrypt", "decrypt"];
const ALGO = { name: "AES-GCM", length: 256 } as const;

let cachedKey: CryptoKey | null = null;

/** Load the encryption key from BOOKING_TOKEN_KEY env var, cached per worker. */
async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const raw = process.env.BOOKING_TOKEN_KEY;
  if (!raw) throw new Error("BOOKING_TOKEN_KEY env var not set");
  const bytes = base64ToBytes(raw);
  if (bytes.length !== 32) {
    throw new Error(`BOOKING_TOKEN_KEY must decode to 32 bytes, got ${bytes.length}`);
  }
  cachedKey = await crypto.subtle.importKey("raw", bytes, ALGO, false, KEY_USAGES);
  return cachedKey;
}

/** Encrypt a string. Returns { ct, iv } as base64 strings. */
export async function encrypt(
  plaintext: string,
): Promise<{ ct: string; iv: string }> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV (GCM standard)
  const data = new TextEncoder().encode(plaintext);
  const ctBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return {
    ct: bytesToBase64(new Uint8Array(ctBuf)),
    iv: bytesToBase64(iv),
  };
}

/** Decrypt a previously encrypted payload. Throws on tamper. */
export async function decrypt(ct: string, iv: string): Promise<string> {
  const key = await getKey();
  const ctBytes = base64ToBytes(ct);
  const ivBytes = base64ToBytes(iv);
  const ptBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    ctBytes,
  );
  return new TextDecoder().decode(ptBuf);
}

// ── base64 helpers (Web Crypto-friendly, no Buffer) ──────────────

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  // Use an explicit ArrayBuffer (not SharedArrayBuffer) so the result is
  // assignable to BufferSource in crypto.subtle.* calls under strict TS.
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(b64u: string): Uint8Array<ArrayBuffer> {
  const pad = b64u.length % 4 === 0 ? "" : "=".repeat(4 - (b64u.length % 4));
  const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return base64ToBytes(b64);
}
