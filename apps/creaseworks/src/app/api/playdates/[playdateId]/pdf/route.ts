/**
 * Server-side PDF generation for playdate cards.
 *
 * GET /api/playdates/[playdateId]/pdf?pack=packSlug
 *
 * Generates a branded, visually structured PDF with:
 * - title + headline
 * - at-a-glance grid (function, energy, setup time, skills, materials, nice-to-have)
 * - the big idea (rails sentence)
 * - how to play: find, fold, unfold phases
 * - find again mode + prompt
 * - material tips + swap ideas
 * - watermark: org name, user email, pack name, date
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getPackBySlug, isPlaydateInPack } from "@/lib/queries/packs";
import { checkEntitlement } from "@/lib/queries/entitlements";
import { logAccess } from "@/lib/queries/audit";
import { sql } from "@/lib/db";
import {
  PLAYDATE_ENTITLED_COLUMNS,
  columnsToSql,
} from "@/lib/security/column-selectors";
import { generatePlaydatePDF } from "./pdf-generator";

interface Props {
  params: Promise<{ playdateId: string }>;
}

export async function GET(req: NextRequest, { params }: Props) {
  const session = await requireAuth();
  const { playdateId } = await params;
  const packSlug = req.nextUrl.searchParams.get("pack");

  let pack: { id: string; title: string; slug: string } | null = null;

  if (session.isInternal) {
    if (packSlug) {
      pack = await getPackBySlug(packSlug);
    }
  } else {
    if (!packSlug) {
      return NextResponse.json({ error: "missing pack parameter" }, { status: 400 });
    }
    pack = await getPackBySlug(packSlug);
    if (!pack) {
      return NextResponse.json({ error: "pack not found" }, { status: 404 });
    }
    const isEntitled = await checkEntitlement(session.orgId, pack.id);
    if (!isEntitled) {
      return NextResponse.json({ error: "not entitled" }, { status: 403 });
    }
    const inPack = await isPlaydateInPack(playdateId, pack.id);
    if (!inPack) {
      return NextResponse.json({ error: "playdate not in pack" }, { status: 404 });
    }
  }

  // fetch full playdate
  const cols = columnsToSql(PLAYDATE_ENTITLED_COLUMNS);
  const result = await sql.query(
    `SELECT ${cols} FROM playdates_cache WHERE id = $1 AND status = 'ready' LIMIT 1`,
    [playdateId],
  );
  const playdate = result.rows[0];
  if (!playdate) {
    return NextResponse.json({ error: "playdate not found" }, { status: 404 });
  }

  // fetch linked materials
  const matResult = await sql.query(
    `SELECT m.title, m.form_primary
     FROM materials_cache m
     JOIN playdate_materials pm ON pm.material_id = m.id
     WHERE pm.playdate_id = $1 AND m.do_not_use = false
     ORDER BY m.title ASC`,
    [playdateId],
  );
  const materials = matResult.rows;

  // ── generate PDF ─────────────────────────────────────────────
  try {
    const pdfBytes = await generatePlaydatePDF(playdate, materials, session, pack);

    // log download
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    await logAccess(
      session.userId,
      session.orgId,
      playdate.id,
      pack?.id || null,
      "download_pdf",
      ip,
      [
        "find",
        "fold",
        "unfold",
        "rails_sentence",
        "find_again_mode",
        "find_again_prompt",
        "slots_notes",
        "substitutions_notes",
      ],
    );

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${playdate.slug || "playdate"}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("[pdf] generation failed:", err);
    return NextResponse.json(
      { error: `pdf generation failed: ${err.message}` },
      { status: 500 },
    );
  }
}
