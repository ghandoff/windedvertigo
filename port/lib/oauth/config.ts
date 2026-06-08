/**
 * Shared OAuth config for the agents' remote MCP server.
 *
 * We are a minimal OAuth 2.1 authorization server (authorization-code + PKCE,
 * dynamic client registration) so Claude Desktop / Cowork can connect to the
 * MCP endpoint with a "sign in with winded.vertigo" flow instead of a pasted
 * token. The human login is delegated to the existing Auth.js Google sign-in;
 * this layer only mints/validates the OAuth tokens Claude needs.
 */

export const ISSUER = (process.env.PORT_URL ?? "https://port.windedvertigo.com").replace(/\/$/, "");

/** The protected resource = the combined MCP connector Cowork points at. */
export const RESOURCE = `${ISSUER}/api/mcp/agents/all`;

/** Where the resource's 401 challenge sends clients to discover OAuth. */
export const PROTECTED_RESOURCE_METADATA_URL = `${ISSUER}/.well-known/oauth-protected-resource`;

/**
 * HMAC secret for signing our access/refresh JWTs. We reuse NEXTAUTH_SECRET
 * (already a strong secret in the worker) so there's no extra secret to set
 * before this can run. Key separation can come later via a dedicated secret.
 */
export function oauthSecret(): string {
  const s = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET/AUTH_SECRET not set — cannot sign OAuth tokens");
  return s;
}

const ALLOWED_DOMAIN = "windedvertigo.com";

/** Same allowlist the Auth.js signIn callback enforces: @windedvertigo.com + ALLOWED_EMAILS. */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  if (e.endsWith(`@${ALLOWED_DOMAIN}`)) return true;
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(e);
}

/** Permissive CORS for the OAuth discovery/token endpoints (MCP clients fetch these). */
export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-protocol-version",
    "Access-Control-Max-Age": "86400",
  };
}
