/**
 * API route: /api/vault/[slug]
 *
 * GET  — fetch a single vault activity by slug with tier-aware columns.
 *
 * Public endpoint — unauthenticated users receive teaser-tier columns.
 * Authenticated users get columns matching their highest vault entitlement.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import {
  resolveVaultTier,
  getVaultActivityBySlug,
  getRelatedActivities,
} from "@/lib/queries/vault";
import { assertNoLeakedFields } from "@/lib/security/assert-no-leaked-fields";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const session = await getSession();

    const accessTier = await resolveVaultTier(
      session?.orgId ?? null,
      session?.userId ?? null,
      session?.isInternal ?? false,
    );

    const activity = await getVaultActivityBySlug(slug, accessTier);
    if (!activity) {
      return NextResponse.json(
        { error: "activity not found" },
        { status: 404 },
      );
    }

    // Dev guard
    assertNoLeakedFields(
      [activity] as Record<string, unknown>[],
      `vault_${accessTier}` as "vault_teaser" | "vault_entitled" | "vault_practitioner" | "vault_internal",
    );

    // Related activities are always teaser-level
    const related = await getRelatedActivities(activity.id);

    return NextResponse.json({
      activity,
      related,
      tier: accessTier,
    });
  } catch (error) {
    console.error("vault [slug] GET error:", error);
    return NextResponse.json(
      { error: "failed to fetch vault activity" },
      { status: 500 },
    );
  }
}
