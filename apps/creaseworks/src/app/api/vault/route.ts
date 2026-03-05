/**
 * API route: /api/vault
 *
 * GET — fetch vault activities with tier-based column selection.
 *       ?tier=prme|explorer|practitioner (optional content tier filter)
 *
 * Public endpoint — no auth required. Unauthenticated users get
 * teaser-level columns; authenticated users auto-upgrade via
 * resolveVaultTier() waterfall.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import {
  resolveVaultTier,
  getVaultActivities,
  getVaultActivitiesByTier,
} from "@/lib/queries/vault";
import { assertNoLeakedFields } from "@/lib/security/assert-no-leaked-fields";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const accessTier = await resolveVaultTier(
      session?.orgId ?? null,
      session?.userId ?? null,
      session?.isInternal ?? false,
    );

    const { searchParams } = new URL(req.url);
    const contentTier = searchParams.get("tier");

    const activities = contentTier
      ? await getVaultActivitiesByTier(accessTier, contentTier)
      : await getVaultActivities(accessTier);

    assertNoLeakedFields(
      activities as Record<string, unknown>[],
      `vault_${accessTier}` as "vault_teaser" | "vault_entitled" | "vault_practitioner" | "vault_internal",
    );

    return NextResponse.json({
      activities,
      tier: accessTier,
      total: activities.length,
    });
  } catch (error) {
    console.error("vault GET error:", error);
    return NextResponse.json(
      { error: "failed to fetch vault activities" },
      { status: 500 },
    );
  }
}
