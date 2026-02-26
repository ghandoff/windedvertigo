/**
 * API route: /api/onboarding
 *
 * POST — save quick-start wizard answers and mark onboarding complete
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { sql } from "@/lib/db";
import { parseJsonBody } from "@/lib/api-helpers";

const VALID_AGE_GROUPS = ["toddler", "preschool", "school-age", "older", "mixed"];
const VALID_CONTEXTS = ["home", "classroom", "outdoors", "travel"];
const VALID_ENERGY = ["chill", "medium", "active", "any"];

export async function POST(req: NextRequest) {
  const session = await requireAuth();

  const parsed = await parseJsonBody(req);
  if (parsed instanceof NextResponse) return parsed;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = parsed as Record<string, any>;

  const ageGroups: string[] = Array.isArray(body.ageGroups)
    ? body.ageGroups.filter((v: string) => VALID_AGE_GROUPS.includes(v))
    : [];
  const contexts: string[] = Array.isArray(body.contexts)
    ? body.contexts.filter((v: string) => VALID_CONTEXTS.includes(v))
    : [];
  const energy: string = VALID_ENERGY.includes(body.energy) ? body.energy : "any";

  const prefs = { age_groups: ageGroups, contexts, energy };

  await sql.query(
    `UPDATE users
        SET onboarding_completed = TRUE,
            play_preferences = $1,
            updated_at = NOW()
      WHERE id = $2`,
    [JSON.stringify(prefs), session.userId],
  );

  return NextResponse.json({ success: true, preferences: prefs });
}
