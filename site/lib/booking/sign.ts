/**
 * HMAC-SHA256 signed token mint/verify via Web Crypto.
 *
 * Used for cancel/reschedule URLs sent in confirmation emails, and for
 * the OAuth `state` parameter to bind the callback to the originating host.
 *
 * Token format:  base64url(payload).base64url(signature)
 *
 * The payload is JSON with a required `exp` (unix seconds). Verification
 * checks the signature first (constant-time via crypto.subtle.verify),
 * then the expiry.
 */

import { bytesToBase64Url, base64UrlToBytes } from "./crypto";

const ALGO = { name: "HMAC", hash: "SHA-256" } as const;

let cachedSignKey: CryptoKey | null = null;

async function getSignKey(): Promise<CryptoKey> {
  if (cachedSignKey) return cachedSignKey;
  const raw = process.env.BOOKING_SIGNING_KEY;
  if (!raw) throw new Error("BOOKING_SIGNING_KEY env var not set");
  const bytes = base64UrlToBytes(raw.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_"));
  cachedSignKey = await crypto.subtle.importKey("raw", bytes, ALGO, false, [
    "sign",
    "verify",
  ]);
  return cachedSignKey;
}

/**
 * Mint a token. Payload is JSON-serialized; an `exp` (unix seconds) is
 * required and added by the caller.
 *
 *   const token = await mint({ bid: 'uuid', act: 'cancel', exp: nowSec()+86400 });
 */
export async function mint<T extends { exp: number }>(payload: T): Promise<string> {
  const key = await getSignKey();
  const payloadJson = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(payloadJson);
  const sigBuf = await crypto.subtle.sign(ALGO, key, payloadBytes);
  return `${bytesToBase64Url(payloadBytes)}.${bytesToBase64Url(new Uint8Array(sigBuf))}`;
}

/**
 * Verify a token and return the payload. Throws on invalid sig, malformed
 * structure, or expired payload.
 */
export async function verify<T extends { exp: number }>(token: string): Promise<T> {
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("invalid token format");

  const key = await getSignKey();
  const payloadBytes = base64UrlToBytes(parts[0]);
  const sigBytes = base64UrlToBytes(parts[1]);

  const ok = await crypto.subtle.verify(ALGO, key, sigBytes, payloadBytes);
  if (!ok) throw new Error("invalid signature");

  const payloadJson = new TextDecoder().decode(payloadBytes);
  let payload: T;
  try {
    payload = JSON.parse(payloadJson) as T;
  } catch {
    throw new Error("invalid token payload");
  }

  if (typeof payload.exp !== "number") throw new Error("token missing exp");
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("token expired");

  return payload;
}

/** Helper: current unix timestamp in seconds. */
export const nowSec = (): number => Math.floor(Date.now() / 1000);

// ── strongly-typed token shapes ────────────────────────────────────

export type CancelTokenPayload = {
  bid: string;       // booking id
  act: "cancel";
  exp: number;
};

export type RescheduleTokenPayload = {
  bid: string;
  act: "reschedule";
  exp: number;
};

export type OauthStateTokenPayload = {
  hostId: string;
  nonce: string;     // random string for CSRF binding
  exp: number;
};

export type PrefillTokenPayload = {
  name: string;
  email: string;
  curious: string;
  valuable: string;
  quadrant: string | null;
  quadrantHistory: string[];
  exp: number;
};

// Helpers for the common payload shapes — type narrowing convenience.

export const mintCancelToken = (bid: string, ttlSec = 60 * 60 * 24 * 30) =>
  mint<CancelTokenPayload>({ bid, act: "cancel", exp: nowSec() + ttlSec });

export const mintRescheduleToken = (bid: string, ttlSec = 60 * 60 * 24 * 30) =>
  mint<RescheduleTokenPayload>({ bid, act: "reschedule", exp: nowSec() + ttlSec });

export const verifyCancelToken = (token: string) =>
  verify<CancelTokenPayload>(token).then((p) => {
    if (p.act !== "cancel") throw new Error("token action mismatch");
    return p;
  });

export const verifyRescheduleToken = (token: string) =>
  verify<RescheduleTokenPayload>(token).then((p) => {
    if (p.act !== "reschedule") throw new Error("token action mismatch");
    return p;
  });
