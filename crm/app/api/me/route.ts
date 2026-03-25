/**
 * GET /api/me
 *
 * Returns the current authenticated user's info.
 * Used by client components to auto-fill "logged by" etc.
 */

import { auth } from "@/lib/auth";
import { json, error } from "@/lib/api-helpers";

export async function GET() {
  const session = await auth();
  if (!session?.user) return error("not authenticated", 401);

  const email = session.user.email ?? "";
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
}
