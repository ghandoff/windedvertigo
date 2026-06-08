/** RFC 7591 — Dynamic Client Registration. Public PKCE clients (no secret). */
import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/oauth/config";
import { putClient } from "@/lib/oauth/store";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    redirect_uris?: unknown;
    client_name?: unknown;
  };
  const redirect_uris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((u): u is string => typeof u === "string")
    : [];
  if (redirect_uris.length === 0) {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "redirect_uris is required" },
      { status: 400, headers: corsHeaders() },
    );
  }
  const client_id = crypto.randomUUID().replace(/-/g, "");
  const created_at = Math.floor(Date.now() / 1000);
  const client_name = typeof body.client_name === "string" ? body.client_name : undefined;
  await putClient({ client_id, redirect_uris, client_name, created_at });

  return NextResponse.json(
    {
      client_id,
      client_id_issued_at: created_at,
      redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      ...(client_name ? { client_name } : {}),
    },
    { status: 201, headers: corsHeaders() },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
