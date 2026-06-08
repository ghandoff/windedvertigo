/** RFC 8414 — OAuth 2.0 Authorization Server Metadata. */
import { NextResponse } from "next/server";
import { ISSUER, corsHeaders } from "@/lib/oauth/config";

export async function GET() {
  return NextResponse.json(
    {
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/api/oauth/authorize`,
      token_endpoint: `${ISSUER}/api/oauth/token`,
      registration_endpoint: `${ISSUER}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["mcp"],
    },
    { headers: corsHeaders() },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
