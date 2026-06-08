/**
 * OAuth 2.1 token endpoint. Supports authorization_code (with PKCE) and
 * refresh_token grants. Access/refresh tokens are stateless signed JWTs.
 */
import { NextRequest, NextResponse } from "next/server";
import { ISSUER, RESOURCE, corsHeaders, oauthSecret } from "@/lib/oauth/config";
import { takeCode } from "@/lib/oauth/store";
import { verifyPkceS256 } from "@/lib/oauth/pkce";
import { signJwt, verifyJwt } from "@/lib/oauth/jwt";

const ACCESS_TTL = 60 * 60 * 24 * 30; // 30 days
const REFRESH_TTL = 60 * 60 * 24 * 180; // 180 days

function tokenError(error: string, desc?: string, status = 400) {
  return NextResponse.json(
    { error, ...(desc ? { error_description: desc } : {}) },
    { status, headers: corsHeaders() },
  );
}

async function issueTokens(email: string, aud: string, scope: string) {
  const now = Math.floor(Date.now() / 1000);
  const secret = oauthSecret();
  const resource = aud || RESOURCE;
  const access_token = await signJwt(
    { sub: email, aud: resource, iss: ISSUER, iat: now, exp: now + ACCESS_TTL, type: "access", scope },
    secret,
  );
  const refresh_token = await signJwt(
    { sub: email, aud: resource, iss: ISSUER, iat: now, exp: now + REFRESH_TTL, type: "refresh", scope },
    secret,
  );
  return NextResponse.json(
    { access_token, token_type: "Bearer", expires_in: ACCESS_TTL, refresh_token, scope },
    { headers: corsHeaders() },
  );
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return tokenError("invalid_request", "expected form-encoded body");
  const grant_type = String(form.get("grant_type") ?? "");

  if (grant_type === "authorization_code") {
    const code = String(form.get("code") ?? "");
    const code_verifier = String(form.get("code_verifier") ?? "");
    const client_id = String(form.get("client_id") ?? "");
    const redirect_uri = String(form.get("redirect_uri") ?? "");

    const data = await takeCode(code);
    if (!data) return tokenError("invalid_grant", "code invalid or expired");
    if (data.client_id !== client_id || data.redirect_uri !== redirect_uri) {
      return tokenError("invalid_grant", "client/redirect mismatch");
    }
    if (!(await verifyPkceS256(code_verifier, data.code_challenge))) {
      return tokenError("invalid_grant", "PKCE verification failed");
    }
    return issueTokens(data.email, data.resource || RESOURCE, data.scope || "mcp");
  }

  if (grant_type === "refresh_token") {
    const refresh = String(form.get("refresh_token") ?? "");
    const claims = await verifyJwt(refresh, oauthSecret());
    if (!claims || claims.type !== "refresh") return tokenError("invalid_grant", "refresh token invalid");
    return issueTokens(claims.sub, claims.aud, claims.scope ?? "mcp");
  }

  return tokenError("unsupported_grant_type");
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
