/**
 * API route: /api/vault/[slug]
 *
 * GET — fetch a single vault activity by slug with tier-based column selection.
 *
 * Public endpoint — no auth required. Unauthenticated users get
 * teaser-level columns; authenticated users auto-upgrade via
 * resolveVaultTier() waterfall.
 *
 * Returns 404 if the slug doesn't exist.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import {
  resolveVaultTier,
  getVaultActivityBySlug,
  getRelatedActivities,
} from "@/lib/queries/vault";
import { assertNoLeakedFields } from "@/lib/security/assert-no-leaked-fields";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;
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

    assertNoLeakedFields(
      [activity] as Record<string, unknown>[],
      `vault_${accessTier}` as "vault_teaser" | "vault_entitled" | "vault_practitioner" | "vault_internal",
    );

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
