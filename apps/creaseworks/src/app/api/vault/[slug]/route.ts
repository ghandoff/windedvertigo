/**
 * GET /api/vault/:slug
 *
 * Single vault activity detail with tier-aware column filtering.
 * Related activities are always returned at teaser level.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import {
  resolveVaultTier,
  getVaultActivityBySlug,
  getRelatedActivities,
} from "@/lib/queries/vault";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const session = await getSession();

  const tier = await resolveVaultTier(
    session?.orgId ?? null,
    session?.userId ?? null,
    session?.isInternal ?? false,
  );

  const activity = await getVaultActivityBySlug(slug, tier);

  if (!activity) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const related = await getRelatedActivities(activity.id);

  return NextResponse.json({ activity, related, tier });
}
