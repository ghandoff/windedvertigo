/**
 * GET /api/vault
 *
 * Public vault activity listing. Supports unauthenticated browsing
 * (teaser tier) — authenticated users get tier-appropriate columns
 * based on their pack entitlements.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import { resolveVaultTier, getVaultActivities } from "@/lib/queries/vault";

export async function GET() {
  const session = await getSession();

  const tier = await resolveVaultTier(
    session?.orgId ?? null,
    session?.userId ?? null,
    session?.isInternal ?? false,
  );

  const activities = await getVaultActivities(tier);

  return NextResponse.json({ activities, tier });
}
