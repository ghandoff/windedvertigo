/** RFC 9728 — OAuth 2.0 Protected Resource Metadata for the MCP connector. */
import { NextResponse } from "next/server";
import { ISSUER, RESOURCE, corsHeaders } from "@/lib/oauth/config";

export async function GET() {
  return NextResponse.json(
    {
      resource: RESOURCE,
      authorization_servers: [ISSUER],
      scopes_supported: ["mcp"],
      bearer_methods_supported: ["header"],
    },
    { headers: corsHeaders() },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
