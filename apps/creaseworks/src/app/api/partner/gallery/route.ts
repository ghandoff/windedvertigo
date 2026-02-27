/**
 * API route: /api/partner/gallery
 *
 * GET — fetch approved gallery evidence for a partner's organization.
 *       ?limit=20&offset=0 (default limit 20, offset 0)
 *
 * Requires partner API key with scope: read:gallery
 * Returns the same gallery data as the public gallery API, but filtered
 * to items uploaded by users in the partner's organization.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePartnerAuth, requireScope } from "@/lib/partner-auth";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  // Validate partner API key
  const auth = await requirePartnerAuth(req);
  if (auth instanceof NextResponse) return auth;

  // Check scope
  if (!requireScope(auth, "read:gallery")) {
    return NextResponse.json(
      { error: "insufficient permissions (requires read:gallery scope)" },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)), 100);
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

    // Fetch approved gallery items for this org with pagination
    const [itemsResult, countResult] = await Promise.all([
      sql.query(
        `SELECT
           re.id, re.evidence_type,
           re.storage_key, re.thumbnail_key,
           re.quote_text, re.quote_attribution,
           re.body,
           re.created_at,
           r.id AS run_id,
           p.title AS playdate_title,
           COALESCE(
             NULLIF(u.name, ''),
             SPLIT_PART(u.email, '@', 1)
           ) AS user_first_name
         FROM run_evidence re
         JOIN runs_cache r ON r.id = re.run_id
         LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
         JOIN users u ON u.id = r.created_by
         INNER JOIN org_users ou ON ou.user_id = r.created_by
         WHERE re.shared_to_gallery = TRUE
           AND re.gallery_approved = TRUE
           AND ou.org_id = $1
         ORDER BY re.created_at DESC
         LIMIT $2 OFFSET $3`,
        [auth.orgId, limit, offset],
      ),

      sql.query(
        `SELECT COUNT(*)::int AS count
         FROM run_evidence re
         JOIN runs_cache r ON r.id = re.run_id
         INNER JOIN org_users ou ON ou.user_id = r.created_by
         WHERE re.shared_to_gallery = TRUE
           AND re.gallery_approved = TRUE
           AND ou.org_id = $1`,
        [auth.orgId],
      ),
    ]);

    const items = itemsResult.rows;
    const total = countResult.rows[0]?.count ?? 0;

    return NextResponse.json({
      data: items,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("[partner-gallery] GET error:", error);
    return NextResponse.json(
      { error: "failed to fetch gallery" },
      { status: 500 },
    );
  }
}
