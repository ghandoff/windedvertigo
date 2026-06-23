import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { getCarlDomains } from "@/lib/supabase/carl";

// Public read — no auth required. MCP tools and the /carl page both call this
// to build the canonical domain list and validate incoming domain strings.
export async function GET(_req: NextRequest) {
  try {
    const domains = await getCarlDomains();
    return json(domains);
  } catch (err) {
    console.error("[api/carl/domains] GET failed:", err);
    return error("failed to load domains", 500);
  }
}
