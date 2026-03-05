/**
 * Progressive disclosure tier — casual, curious, collaborator.
 * Vault-only subset: just getUserTier() for the auth JWT callback.
 */

import { sql } from "@/lib/db";

export type UiTier = "casual" | "curious" | "collaborator";

const VALID_TIERS: UiTier[] = ["casual", "curious", "collaborator"];

/**
 * Get the user's progressive disclosure tier.
 * Returns "casual" as default if user not found.
 */
export async function getUserTier(userId: string): Promise<UiTier> {
  const r = await sql.query(
    "SELECT ui_tier FROM users WHERE id = $1 LIMIT 1",
    [userId],
  );
  const tier = r.rows[0]?.ui_tier;
  return VALID_TIERS.includes(tier) ? tier : "casual";
}
