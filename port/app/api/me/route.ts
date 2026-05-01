/**
 * GET /api/me
 *
 * Returns the current authenticated user's info.
 * Used by client components to auto-fill "logged by" etc.
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { json, error } from "@/lib/api-helpers";

export const GET = auth(async (req) => {
  const session = req.auth;
  if (!session?.user) return error("not authenticated", 401);

  const email = session.user.email ?? "";
  // Try firstName from JWT token, fall back to Google profile name
  const firstName =
    (session as unknown as Record<string, unknown>).firstName as string ??
    session.user.name?.split(" ")[0]?.toLowerCase() ??
    email.split("@")[0];

  return json({
    email,
    name: session.user.name ?? "",
    firstName,
    image: session.user.image ?? "",
  });
}) as unknown as (req: NextRequest) => Promise<Response>;
