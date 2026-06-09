/** PKCE S256 verification (OAuth 2.1 mandatory). */

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** true if BASE64URL(SHA256(verifier)) === challenge. */
export async function verifyPkceS256(verifier: string, challenge: string): Promise<boolean> {
  if (!verifier || !challenge) return false;
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(verifier));
  return b64url(digest) === challenge;
}
