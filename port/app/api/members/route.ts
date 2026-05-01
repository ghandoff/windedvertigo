/**
 * GET /api/members — list active collective members
 *
 * Phase G.1.3: GET reads from Supabase (faster, no rate limits).
 * No writes — members are managed directly in Notion.
 */

import { getActiveMembersFromSupabase } from "@/lib/supabase/members";
import { json, error } from "@/lib/api-helpers";

export const revalidate = 300; // cache for 5 minutes

export async function GET() {
  try {
    const members = await getActiveMembersFromSupabase();
    return json({ data: members });
  } catch (err) {
    console.error("[api/members] Supabase query failed:", err);
    return error("failed to load members", 500);
  }
}
