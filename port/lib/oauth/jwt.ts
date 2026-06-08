/**
 * Minimal HS256 JWT sign/verify using Web Crypto (Cloudflare Workers-compatible).
 * Used for stateless OAuth access + refresh tokens — no token store needed.
 */

const enc = new TextEncoder();

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlFromStr(s: string): string {
  return b64urlFromBytes(enc.encode(s));
}
function bytesFromB64url(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export interface JwtClaims {
  sub: string; // user email
  aud: string; // resource URL
  iss: string;
  iat: number;
  exp: number;
  type: "access" | "refresh";
  scope?: string;
}

export async function signJwt(claims: JwtClaims, secret: string): Promise<string> {
  const header = b64urlFromStr(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64urlFromStr(JSON.stringify(claims));
  const data = `${header}.${payload}`;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(data));
  return `${data}.${b64urlFromBytes(new Uint8Array(sig))}`;
}

/** Verify signature + expiry. Returns claims or null. */
export async function verifyJwt(token: string, secret: string): Promise<JwtClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  let ok: boolean;
  try {
    const sig = bytesFromB64url(s) as unknown as BufferSource;
    ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), sig, enc.encode(`${h}.${p}`));
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(bytesFromB64url(p))) as JwtClaims;
    if (typeof claims.exp === "number" && Math.floor(Date.now() / 1000) >= claims.exp) return null;
    return claims;
  } catch {
    return null;
  }
}
