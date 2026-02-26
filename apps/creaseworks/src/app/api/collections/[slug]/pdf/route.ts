/**
 * Server-side batch PDF generation for collection booklets.
 *
 * GET /api/collections/[slug]/pdf
 *
 * Generates a branded, multi-page PDF booklet with:
 * - cover page (collection title, description, playdate count)
 * - table of contents
 * - each playdate as a separate page using existing PDF generation utilities
 * - headers with collection name and page numbers
 * - footer watermarks
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getCollectionBySlug, getCollectionPlaydates } from "@/lib/queries/collections";
import { sql } from "@/lib/db";
import {
  PLAYDATE_ENTITLED_COLUMNS,
  columnsToSql,
} from "@/lib/security/column-selectors";
import { generateCollectionPDF } from "./pdf-generator";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, { params }: Props) {
  const session = await requireAuth();
  const { slug } = await params;

  // Fetch collection by slug
  const collection = await getCollectionBySlug(slug);
  if (!collection) {
    return NextResponse.json({ error: "collection not found" }, { status: 404 });
  }

  // Fetch all playdates in the collection
  const collectionPlaydates = await getCollectionPlaydates(collection.id, session.userId);

  if (collectionPlaydates.length === 0) {
    return NextResponse.json(
      { error: "collection has no playdates" },
      { status: 400 },
    );
  }

  // Fetch full playdate data for each one (including all entitled columns + materials)
  const playdateIds = collectionPlaydates.map((p) => p.id);
  const cols = columnsToSql(PLAYDATE_ENTITLED_COLUMNS);

  const playdatesResult = await sql.query(
    `SELECT ${cols} FROM playdates_cache WHERE id = ANY($1) AND status = 'ready' ORDER BY id`,
    [playdateIds],
  );
  const playdates = playdatesResult.rows;

  if (playdates.length === 0) {
    return NextResponse.json(
      { error: "no playdates found for collection" },
      { status: 400 },
    );
  }

  // Fetch materials for each playdate
  const materialsResult = await sql.query(
    `SELECT pm.playdate_id, m.title, m.form_primary
     FROM materials_cache m
     JOIN playdate_materials pm ON pm.material_id = m.id
     WHERE pm.playdate_id = ANY($1) AND m.do_not_use = false
     ORDER BY pm.playdate_id, m.title ASC`,
    [playdateIds],
  );

  // Group materials by playdate_id
  const materialsByPlaydate: { [key: string]: Array<{ title: string; form_primary: string | null }> } = {};
  for (const mat of materialsResult.rows) {
    if (!materialsByPlaydate[mat.playdate_id]) {
      materialsByPlaydate[mat.playdate_id] = [];
    }
    materialsByPlaydate[mat.playdate_id].push({
      title: mat.title,
      form_primary: mat.form_primary,
    });
  }

  // Generate PDF
  try {
    const pdfBytes = await generateCollectionPDF(
      collection,
      playdates,
      materialsByPlaydate,
      session,
    );

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${collection.slug || "collection"}-booklet.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("[collection-pdf] generation failed:", err);
    return NextResponse.json(
      { error: `pdf generation failed: ${err.message}` },
      { status: 500 },
    );
  }
}
